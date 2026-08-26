/**
 * Adds shift-persistence columns on cc_agent_sessions and cc_settings.shift_policy.
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-shift-persistence.ts
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
      || msg.includes('Duplicate key name')
      || msg.includes('check that column/key exists')
      || msg.includes('already exists')
      || msg.includes('Duplicate')
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
      'cc_agent_sessions.last_status',
      `ALTER TABLE cc_agent_sessions ADD COLUMN last_status VARCHAR(32) NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_agent_sessions.last_status_at',
      `ALTER TABLE cc_agent_sessions ADD COLUMN last_status_at DATETIME NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_agent_sessions.pause_reason',
      `ALTER TABLE cc_agent_sessions ADD COLUMN pause_reason VARCHAR(128) NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_agent_sessions.queues_snapshot',
      `ALTER TABLE cc_agent_sessions ADD COLUMN queues_snapshot JSON NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_agent_sessions.softphone_mode',
      `ALTER TABLE cc_agent_sessions ADD COLUMN softphone_mode VARCHAR(16) NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_agent_sessions.panel_seen_at',
      `ALTER TABLE cc_agent_sessions ADD COLUMN panel_seen_at DATETIME NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_agent_sessions.close_reason',
      `ALTER TABLE cc_agent_sessions ADD COLUMN close_reason VARCHAR(32) NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_agent_sessions.last_status_origin',
      `ALTER TABLE cc_agent_sessions ADD COLUMN last_status_origin VARCHAR(16) NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_settings.shift_policy',
      `ALTER TABLE cc_settings ADD COLUMN shift_policy JSON NULL`,
    );

    console.log('[migration] shift-persistence migration complete.');
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
