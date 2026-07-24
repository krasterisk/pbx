/**
 * Phase 9 UAT follow-up — configurable auto-pause master switch.
 *
 * Adds `cc_settings.autopause_enabled` (BOOLEAN NOT NULL DEFAULT TRUE) so
 * supervisors can turn off the whole auto-pause engine (RONA + flexible rules).
 * When disabled, CallCenterAutoPauseService short-circuits all evaluators.
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-autopause-enabled.ts
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
      'cc_settings.autopause_enabled',
      `ALTER TABLE cc_settings
       ADD COLUMN autopause_enabled TINYINT(1) NOT NULL DEFAULT 1`,
    );

    console.log('[migration] autopause_enabled migration complete.');
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
