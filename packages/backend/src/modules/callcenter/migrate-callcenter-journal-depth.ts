/**
 * Phase 10 — softphone Journal depth tenant setting (D-04).
 *
 * Adds `cc_settings.journal_depth` (INTEGER NOT NULL DEFAULT 50) so the Journal
 * tab last-N is admin-configurable rather than hardcoded on the frontend.
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-journal-depth.ts
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
      'cc_settings.journal_depth',
      `ALTER TABLE cc_settings
       ADD COLUMN journal_depth INT NOT NULL DEFAULT 50`,
    );

    console.log('[migration] journal_depth migration complete.');
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
