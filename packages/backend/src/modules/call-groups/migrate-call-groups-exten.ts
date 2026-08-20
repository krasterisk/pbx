/**
 * D-33: add call_groups.exten, fill deterministic numbers, unique index, then NOT NULL.
 *
 * Assigned number rule (existing rows only):
 *   `6` + uid padded to 3 digits  → uid 7 → "6007", uid 15 → "6015"
 * Range stays clear of typical internals (1xx/1xxx) and most queue numbers.
 * Collisions with queue_table (q{exten}_{vpbx}) and ps_endpoints (e{exten}_{vpbx})
 * abort the migration with a listed conflict — never skip silently (T-12-14-05).
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/call-groups/migrate-call-groups-exten.ts
 */
import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

export const CALL_GROUPS_TABLE = 'call_groups';
export const CALL_GROUPS_EXTEN_INDEX = 'call_groups_vpbx_exten_uniq';
export const CALL_GROUP_EXTEN_PREFIX = '6';
export const CALL_GROUP_EXTEN_PAD = 3;

export type MigrateStepStatus = 'applied' | 'already';

export interface MigrateExtenReport {
  addColumn: MigrateStepStatus;
  fillExten: MigrateStepStatus;
  addIndex: MigrateStepStatus;
  notNull: MigrateStepStatus;
  filled: number;
  remainingNull: number;
}

export type SqlQuery = (sql: string, options?: unknown) => Promise<unknown>;

export function assignedExtenForUid(uid: number): string {
  return `${CALL_GROUP_EXTEN_PREFIX}${String(uid).padStart(CALL_GROUP_EXTEN_PAD, '0')}`;
}

export function indexNames(indexes: Array<{ name?: string; Name?: string; Key_name?: string }>): string[] {
  return indexes.map((i) => i.name ?? i.Name ?? i.Key_name ?? '');
}

function columnAllowNull(col: unknown): boolean | undefined {
  if (!col || typeof col !== 'object') return undefined;
  const rec = col as { allowNull?: boolean };
  return rec.allowNull;
}

async function queryRows<T extends object>(query: SqlQuery, sql: string, replacements?: Record<string, unknown>): Promise<T[]> {
  const result = await query(sql, replacements ? { replacements } : undefined);
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  if (Array.isArray(result)) return result as T[];
  return [];
}

function parseQueueName(name: string): { exten: string; vpbx: number } | null {
  const m = /^q(.+)_(\d+)$/.exec(name);
  if (!m) return null;
  return { exten: m[1], vpbx: Number(m[2]) };
}

function parseEndpointId(id: string): { exten: string; vpbx: number } | null {
  if (id.startsWith('ew')) return null;
  const m = /^e([^_]+)_(\d+)$/.exec(id);
  if (!m) return null;
  return { exten: m[1], vpbx: Number(m[2]) };
}

export function collectOccupiedExtens(input: {
  groups: Array<{ uid: number; vpbx: number; exten: string | null }>;
  queues: Array<{ name: string }>;
  endpoints: Array<{ id: string }>;
}): Map<string, string> {
  const occupied = new Map<string, string>();
  const key = (vpbx: number, exten: string) => `${vpbx}:${exten}`;

  for (const g of input.groups) {
    if (g.exten) occupied.set(key(g.vpbx, g.exten), `call_groups.uid=${g.uid}`);
  }
  for (const q of input.queues) {
    const parsed = parseQueueName(q.name);
    if (parsed) occupied.set(key(parsed.vpbx, parsed.exten), `queue_table.name=${q.name}`);
  }
  for (const ep of input.endpoints) {
    const parsed = parseEndpointId(ep.id);
    if (parsed) occupied.set(key(parsed.vpbx, parsed.exten), `ps_endpoints.id=${ep.id}`);
  }
  return occupied;
}

export async function runCallGroupsExtenMigrate(
  qi: QueryInterface,
  query: SqlQuery,
  log: (msg: string) => void = console.log,
): Promise<MigrateExtenReport> {
  const report: MigrateExtenReport = {
    addColumn: 'already',
    fillExten: 'already',
    addIndex: 'already',
    notNull: 'already',
    filled: 0,
    remainingNull: 0,
  };

  const described = (await qi.describeTable(CALL_GROUPS_TABLE)) as Record<string, unknown>;
  if (!described.exten) {
    await qi.addColumn(CALL_GROUPS_TABLE, 'exten', {
      type: DataTypes.STRING(8),
      allowNull: true,
    });
    log('[migration] addColumn exten: applied');
    report.addColumn = 'applied';
  } else {
    log('[migration] addColumn exten: already applied');
  }

  const groups = await queryRows<{ uid: number; vpbx_user_uid: number; name: string; exten: string | null }>(
    query,
    'SELECT uid, vpbx_user_uid, name, exten FROM call_groups',
  );
  const missing = groups.filter((g) => g.exten == null || g.exten === '');

  if (missing.length > 0) {
    const queues = await queryRows<{ name: string }>(query, 'SELECT name FROM queue_table');
    const endpoints = await queryRows<{ id: string }>(query, 'SELECT id FROM ps_endpoints');
    const occupied = collectOccupiedExtens({
      groups: groups
        .filter((g) => g.exten)
        .map((g) => ({ uid: g.uid, vpbx: g.vpbx_user_uid, exten: g.exten })),
      queues,
      endpoints,
    });

    const conflicts: string[] = [];
    const assignments: Array<{ uid: number; exten: string }> = [];
    const pending = new Map<string, number>();

    for (const g of missing) {
      const exten = assignedExtenForUid(g.uid);
      const key = `${g.vpbx_user_uid}:${exten}`;
      const owner = occupied.get(key);
      if (owner) {
        conflicts.push(`group uid=${g.uid} (${g.name}) → ${exten} conflicts with ${owner}`);
        continue;
      }
      const pendingOwner = pending.get(key);
      if (pendingOwner !== undefined) {
        conflicts.push(`group uid=${g.uid} (${g.name}) → ${exten} conflicts with pending group uid=${pendingOwner}`);
        continue;
      }
      pending.set(key, g.uid);
      assignments.push({ uid: g.uid, exten });
    }

    if (conflicts.length) {
      throw new Error(
        `call_groups.exten fill aborted — collisions with queues/internals:\n${conflicts.join('\n')}`,
      );
    }

    for (const a of assignments) {
      await query('UPDATE call_groups SET exten = :exten WHERE uid = :uid AND (exten IS NULL OR exten = \'\')', {
        replacements: { exten: a.exten, uid: a.uid },
      });
    }
    report.fillExten = 'applied';
    report.filled = assignments.length;
    log(`[migration] fillExten: applied (${assignments.length} rows)`);
  } else {
    log('[migration] fillExten: already applied');
  }

  const afterFill = await queryRows<{ n: number }>(
    query,
    'SELECT COUNT(*) AS n FROM call_groups WHERE exten IS NULL OR exten = \'\'',
  );
  report.remainingNull = Number(afterFill[0]?.n ?? 0);
  if (report.remainingNull > 0) {
    throw new Error(`call_groups.exten fill left ${report.remainingNull} NULL/empty rows`);
  }

  const indexes = indexNames(
    (await qi.showIndex(CALL_GROUPS_TABLE)) as Array<{ name?: string; Name?: string; Key_name?: string }>,
  );
  if (!indexes.includes(CALL_GROUPS_EXTEN_INDEX)) {
    await qi.addIndex(CALL_GROUPS_TABLE, ['vpbx_user_uid', 'exten'], {
      unique: true,
      name: CALL_GROUPS_EXTEN_INDEX,
    });
    report.addIndex = 'applied';
    log(`[migration] addIndex ${CALL_GROUPS_EXTEN_INDEX}: applied`);
  } else {
    log(`[migration] addIndex ${CALL_GROUPS_EXTEN_INDEX}: already applied`);
  }

  const describedAfter = (await qi.describeTable(CALL_GROUPS_TABLE)) as Record<string, unknown>;
  const allowNull = columnAllowNull(describedAfter.exten);
  if (allowNull !== false) {
    await qi.changeColumn(CALL_GROUPS_TABLE, 'exten', {
      type: DataTypes.STRING(8),
      allowNull: false,
    });
    report.notNull = 'applied';
    log('[migration] changeColumn NOT NULL: applied');
  } else {
    log('[migration] changeColumn NOT NULL: already applied');
  }

  if (
    report.addColumn === 'already' &&
    report.fillExten === 'already' &&
    report.addIndex === 'already' &&
    report.notNull === 'already'
  ) {
    log('[migration] all four steps already applied');
  }

  return report;
}

async function main(): Promise<void> {
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'krasterisk',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'krasterisk',
    logging: console.log,
  });

  try {
    const qi = sequelize.getQueryInterface();
    const report = await runCallGroupsExtenMigrate(
      qi,
      (sql, options) => sequelize.query(sql, options as never),
    );
    console.log(
      `[migration] call_groups.exten complete. remainingNull=${report.remainingNull} filled=${report.filled}`,
    );
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
