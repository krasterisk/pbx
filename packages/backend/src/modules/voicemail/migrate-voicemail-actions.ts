/**
 * Phase 13 voicemail action-params rewrite (D-54).
 *
 * Targets — same six JSON columns as Phase 12 (PHASE12_ACTION_TARGETS):
 *   1. routes.actions                          action[]
 *   2. route_phonebook_bindings.actions        action[]
 *   3. ivrs.menu_items[].actions               nested action[]
 *   4. voice_robot_keywords.actions            action[]
 *   5. voice_robots.fallback_action            action[]
 *   6. voice_robots.max_retries_action         action[]
 *
 * `routes.raw_dialplan` is SELECT/log only — never rewritten.
 *
 * Run from packages/backend:
 *   npx ts-node src/modules/voicemail/migrate-voicemail-actions.ts --dry-run
 *   npx ts-node src/modules/voicemail/migrate-voicemail-actions.ts
 *
 * Always run --dry-run first. Default mode writes. Affected values are copied
 * to `.backup/phase13-voicemail-actions-<timestamp>.json` before UPDATE (tenant data).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { migrateActionChain, migrateVoicemailParams } from '../routes/dialplan-actions-migration.util';
import {
  PHASE12_ACTION_TARGETS,
  type BackupEntry,
  type MigrationIo,
  type MigrationStore,
  type Phase12ActionTarget,
  type RunMigrationResult,
  type TargetReport,
  type TargetRow,
  type UnmappedHit,
} from '../routes/migrate-dialplan-actions-phase12';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/** Old Asterisk mailbox application invocation — logged on routes.raw_dialplan, never rewritten. */
export const MAILBOX_APP_SUBSTRING = 'VoiceMail(';

export interface MailboxDialplanHit {
  id: number;
}

/**
 * Count routes whose free-text dialplan still contains the mailbox application.
 * Read-only: SELECT + log. Does not write any column.
 */
export async function scanRawDialplanMailboxHits(
  findHits: () => Promise<MailboxDialplanHit[]>,
  log: (line: string) => void,
): Promise<number> {
  const hits = await findHits();
  log(`[raw_dialplan] mailbox application hits=${hits.length} (log only, not rewritten)`);
  return hits.length;
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
    const chain = migrateActionChain(row.actions, migrateVoicemailParams);
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
): { value: unknown; changed: boolean; converted: number; unmapped: Array<{ type: string; index: number }> } {
  if (target.shape === 'menu-items') {
    return migrateMenuItems(value);
  }
  return migrateActionChain(value, migrateVoicemailParams);
}

export interface RunVoicemailMigrationOptions {
  dryRun: boolean;
  store: MigrationStore;
  io: MigrationIo;
  backupDir: string;
}

export async function runVoicemailActionMigration(
  opts: RunVoicemailMigrationOptions,
): Promise<RunMigrationResult> {
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
      const migrated = migrateColumn(target, original);
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
  const backupPath = path.join(opts.backupDir, `phase13-voicemail-actions-${stamp}.json`);

  if (backup.length > 0 && !opts.dryRun) {
    await opts.io.writeBackup(backupPath, backup);
    opts.io.log(`[backup] ${backup.length} row(s) → ${backupPath}`);
  } else if (opts.dryRun) {
    opts.io.log(`[dry-run] would write ${backup.length} backup row(s) to ${backupPath}`);
  }

  if (!opts.dryRun) {
    for (const write of pendingWrites) {
      await opts.store.update(write.target, write.id, write.value);
    }
  } else {
    opts.io.log('[dry-run] no writes issued');
  }

  opts.io.log(
    `[summary] rowsChanged=${rowsChanged} actionsConverted=${actionsConverted} unmapped=${unmapped.length} dryRun=${opts.dryRun}`,
  );

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
      const rows = await sequelize.query<TargetRow>(
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

async function loadMailboxHits(sequelize: Sequelize): Promise<MailboxDialplanHit[]> {
  const needle = `%${MAILBOX_APP_SUBSTRING}%`;
  return sequelize.query<MailboxDialplanHit>(
    `SELECT uid AS id FROM \`routes\` WHERE raw_dialplan LIKE :needle`,
    { replacements: { needle }, type: QueryTypes.SELECT },
  );
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
    await scanRawDialplanMailboxHits(
      () => loadMailboxHits(sequelize),
      (line) => console.log(line),
    );
    const result = await runVoicemailActionMigration({
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
      console.log(`[done] ${result.unmapped.length} unmapped action(s) left in place`);
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
