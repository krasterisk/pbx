/**
 * Phase 9 Plan 05 — permission-lock column follow-up.
 *
 * 09-01's schema migration added `role_permission_defaults` on `cc_settings` (D-38/D-39)
 * but no sibling lock column for it (unlike `ui_visibility_locks`/`notification_locks`,
 * which both shipped in that same migration). `CallCenterPermissionsService.getEffective`
 * (09-05 Task 1) requires a per-right lock flag so a locked right cannot be self-overridden
 * (D-06/D-39) — this idempotent follow-up adds that column, mirroring the exact
 * `migrate-callcenter-phase9-schema.ts` pattern.
 *
 * Run (automated):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-permission-locks.ts (from packages/backend)
 */
import { Sequelize } from 'sequelize-typescript';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function alterIdempotent(sequelize: Sequelize, label: string, sql: string): Promise<void> {
  try {
    await sequelize.query(sql);
    console.log(`[migration] ${label}: applied`);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (
      msg.includes('Duplicate column name') ||
      msg.includes('Duplicate key name') ||
      msg.includes('check that column/key exists') ||
      msg.includes('already exists') ||
      msg.includes('Duplicate')
    ) {
      console.log(`[migration] ${label}: already applied — ok`);
      return;
    }
    throw err;
  }
}

async function main() {
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
    await alterIdempotent(
      sequelize,
      'cc_settings.permission_locks',
      `ALTER TABLE cc_settings
       ADD COLUMN permission_locks JSON NULL`,
    );

    console.log('[migration] Phase 9 permission-locks follow-up migration complete.');
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
