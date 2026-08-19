/**
 * Phase 12 dialplan-action rewrite (D-12 / D-20 / D-28 / D-51 / D-29).
 *
 * Targets — 6 JSON columns in 5 tables (grep DataType.JSON on models + 12-RESEARCH.md):
 *   1. routes.actions                          action[]
 *   2. route_phonebook_bindings.actions        action[]
 *   3. ivrs.menu_items[].actions               nested action[]
 *   4. voice_robot_keywords.actions            action[]
 *   5. voice_robots.fallback_action            action[]
 *   6. voice_robots.max_retries_action         action[]
 *
 * `routes.raw_dialplan` is free text and is NOT rewritten.
 *
 * Run from packages/backend:
 *   npx ts-node src/modules/routes/migrate-dialplan-actions-phase12.ts [--dry-run]
 *
 * Default mode writes. Always run --dry-run first. Affected values are copied
 * to `.backup/phase12-actions-<timestamp>.json` before UPDATE (tenant data).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { migrateAction, migrateActionChain } from './dialplan-actions-migration.util';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

export type TargetShape = 'action-array' | 'menu-items';

export interface Phase12ActionTarget {
  table: string;
  column: string;
  shape: TargetShape;
  idField: string;
}

/** Fixed inventory — must stay equal to the JSON action-chain columns found by grep. */
export const PHASE12_ACTION_TARGETS: Phase12ActionTarget[] = [
  { table: 'routes', column: 'actions', shape: 'action-array', idField: 'uid' },
  { table: 'route_phonebook_bindings', column: 'actions', shape: 'action-array', idField: 'uid' },
  { table: 'ivrs', column: 'menu_items', shape: 'menu-items', idField: 'uid' },
  { table: 'voice_robot_keywords', column: 'actions', shape: 'action-array', idField: 'uid' },
  { table: 'voice_robots', column: 'fallback_action', shape: 'action-array', idField: 'uid' },
  { table: 'voice_robots', column: 'max_retries_action', shape: 'action-array', idField: 'uid' },
];

export interface TargetRow {
  id: number;
  value: unknown;
}

export interface UnmappedHit {
  table: string;
  column: string;
  id: number;
  type: string;
  index: number;
}

export interface TargetReport {
  table: string;
  column: string;
  rows: number;
  rowsChanged: number;
  actionsConverted: number;
  unmapped: number;
}

export interface BackupEntry {
  table: string;
  column: string;
  id: number;
  original: unknown;
}

export interface MigrationStore {
  findAll(target: Phase12ActionTarget): Promise<TargetRow[]>;
  update(target: Phase12ActionTarget, id: number, value: unknown): Promise<void>;
}

export interface MigrationIo {
  writeBackup(filePath: string, data: unknown): Promise<void>;
  log(line: string): void;
  now(): Date;
}

export interface RunMigrationOptions {
  dryRun: boolean;
  store: MigrationStore;
  io: MigrationIo;
  backupDir: string;
  migrate?: typeof migrateAction;
}

export interface RunMigrationResult {
  reports: TargetReport[];
  unmapped: UnmappedHit[];
  backupPath: string | null;
  rowsChanged: number;
  actionsConverted: number;
}

function parseJsonColumn(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function migrateMenuItems(
  value: unknown,
  migrate: typeof migrateAction,
): { value: unknown; changed: boolean; converted: number; unmapped: Array<{ type: string; index: number }> } {
  if (!Array.isArray(value)) {
    return { value, changed: false, converted: 0, unmapped: [] };
  }
  let changed = false;
  let converted = 0;
  const unmapped: Array<{ type: string; index: number }> = [];
  let actionIndex = 0;
  const next = value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const row = item as Record<string, unknown>;
    if (!('actions' in row)) return item;
    const chain = migrateActionChain(row.actions, migrate);
    chain.unmapped.forEach((hit) => unmapped.push({ type: hit.type, index: actionIndex + hit.index }));
    actionIndex += Array.isArray(row.actions) ? (row.actions as unknown[]).length : 1;
    if (chain.changed) {
      converted += chain.converted;
      changed = true;
      return { ...row, actions: chain.value };
    }
    return item;
  });
  return { value: next, changed, converted, unmapped };
}

function migrateColumn(
  target: Phase12ActionTarget,
  value: unknown,
  migrate: typeof migrateAction,
): { value: unknown; changed: boolean; converted: number; unmapped: Array<{ type: string; index: number }> } {
  if (target.shape === 'menu-items') {
    return migrateMenuItems(value, migrate);
  }
  return migrateActionChain(value, migrate);
}

export async function runPhase12ActionMigration(opts: RunMigrationOptions): Promise<RunMigrationResult> {
  const migrate = opts.migrate ?? migrateAction;
  const reports: TargetReport[] = [];
  const unmapped: UnmappedHit[] = [];
  const backup: BackupEntry[] = [];
  let rowsChanged = 0;
  let actionsConverted = 0;

  const pendingWrites: Array<{ target: Phase12ActionTarget; id: number; value: unknown }> = [];

  for (const target of PHASE12_ACTION_TARGETS) {
    const rows = await opts.store.findAll(target);
    const report: TargetReport = {
      table: target.table,
      column: target.column,
      rows: rows.length,
      rowsChanged: 0,
      actionsConverted: 0,
      unmapped: 0,
    };

    for (const row of rows) {
      const original = parseJsonColumn(row.value);
      const migrated = migrateColumn(target, original, migrate);
      for (const hit of migrated.unmapped) {
        unmapped.push({
          table: target.table,
          column: target.column,
          id: row.id,
          type: hit.type,
          index: hit.index,
        });
        report.unmapped += 1;
      }
      if (!migrated.changed) continue;
      report.rowsChanged += 1;
      report.actionsConverted += migrated.converted;
      rowsChanged += 1;
      actionsConverted += migrated.converted;
      backup.push({
        table: target.table,
        column: target.column,
        id: row.id,
        original,
      });
      pendingWrites.push({ target, id: row.id, value: migrated.value });
    }
    reports.push(report);
    opts.io.log(
      `[${target.table}.${target.column}] rows=${report.rows} changed=${report.rowsChanged} converted=${report.actionsConverted} unmapped=${report.unmapped}`,
    );
  }

  const stamp = opts.io.now().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(opts.backupDir, `phase12-actions-${stamp}.json`);

  if (backup.length > 0 && !opts.dryRun) {
    await opts.io.writeBackup(backupPath, backup);
    opts.io.log(`[backup] ${backup.length} row(s) → ${backupPath}`);
  } else if (opts.dryRun) {
    opts.io.log(`[dry-run] would write ${backup.length} backup row(s) to ${backupPath}`);
  }

  if (!opts.dryRun) {
    const byTable = new Map<string, Array<{ target: Phase12ActionTarget; id: number; value: unknown }>>();
    for (const write of pendingWrites) {
      const list = byTable.get(write.target.table) ?? [];
      list.push(write);
      byTable.set(write.target.table, list);
    }
    for (const [, writes] of byTable) {
      for (const write of writes) {
        await opts.store.update(write.target, write.id, write.value);
      }
    }
  } else {
    opts.io.log('[dry-run] no UPDATE issued');
  }

  opts.io.log(
    `[summary] rowsChanged=${rowsChanged} actionsConverted=${actionsConverted} unmapped=${unmapped.length} dryRun=${opts.dryRun}`,
  );
  for (const hit of unmapped) {
    opts.io.log(`[unmapped] ${hit.table}.${hit.column} id=${hit.id} type=${hit.type} index=${hit.index}`);
  }

  return {
    reports,
    unmapped,
    backupPath: backup.length > 0 && !opts.dryRun ? backupPath : null,
    rowsChanged,
    actionsConverted,
  };
}

function createSequelizeStore(sequelize: Sequelize): MigrationStore {
  return {
    async findAll(target) {
      const rows = await sequelize.query<{ id: number; value: unknown }>(
        `SELECT \`${target.idField}\` AS id, \`${target.column}\` AS value FROM \`${target.table}\``,
        { type: QueryTypes.SELECT },
      );
      return rows;
    },
    async update(target, id, value) {
      await sequelize.transaction(async (trx) => {
        await sequelize.query(
          `UPDATE \`${target.table}\` SET \`${target.column}\` = :value WHERE \`${target.idField}\` = :id`,
          {
            replacements: { value: JSON.stringify(value), id },
            transaction: trx,
          },
        );
      });
    },
  };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const backupDir = path.join(repoRoot, '.backup');

  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'krasterisk',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'krasterisk',
    logging: false,
  });

  try {
    await sequelize.authenticate();
    const result = await runPhase12ActionMigration({
      dryRun,
      store: createSequelizeStore(sequelize),
      backupDir,
      io: {
        async writeBackup(filePath, data) {
          await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
          await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        },
        log: (line) => console.log(line),
        now: () => new Date(),
      },
    });
    if (result.unmapped.length > 0) {
      console.log(`[done] ${result.unmapped.length} unmapped action(s) left in place (unknown-state)`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  void main();
}
