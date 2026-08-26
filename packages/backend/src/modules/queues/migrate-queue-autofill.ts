/**
 * Ensures queue_table.autofill exists (Asterisk Realtime per-queue param).
 * Also drops leftover queue_table.persistentmembers if present — that flag is
 * global in queues.conf [general], not a Realtime column.
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/queues/migrate-queue-autofill.ts
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
      msg.includes('Duplicate column name')
      || msg.includes('already exists')
      || msg.includes('Duplicate')
      || msg.includes("check that column/key exists")
      || msg.includes("Can't DROP")
      || msg.includes('Unknown column')
    ) {
      console.log(`[migration] ${label}: already applied / absent — ok`);
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
      'queue_table.autofill',
      `ALTER TABLE queue_table ADD COLUMN autofill VARCHAR(8) NULL`,
    );
    await alterIdempotent(
      sequelize,
      'queue_table.persistentmembers DROP',
      `ALTER TABLE queue_table DROP COLUMN persistentmembers`,
    );
    console.log('[migration] queue autofill migration complete.');
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
