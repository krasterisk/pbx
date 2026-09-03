import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 14 cc_callback_requests (D-38 / D-40).
 *
 * Standalone script (pattern: migrate-voicemail.ts) — no migration
 * framework in this repo (app.module.ts: synchronize: false).
 *
 * Run (automated):
 *   npx ts-node src/modules/callback-requests/migrate-callback-requests.ts
 *   (from packages/backend)
 */
export const CALLBACK_REQUEST_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS cc_callback_requests (
    uid INT NOT NULL AUTO_INCREMENT,
    vpbx_user_uid INT NOT NULL DEFAULT 0,
    caller VARCHAR(64) NOT NULL DEFAULT '',
    route_uid INT NULL,
    queue_uid INT NULL,
    queue_name VARCHAR(64) NULL,
    step_id VARCHAR(64) NULL,
    uniqueid VARCHAR(128) NULL,
    status ENUM('pending','dialing','completed','failed','cancelled','expired') NOT NULL DEFAULT 'pending',
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    pause_minutes INT NOT NULL DEFAULT 30,
    next_attempt_at DATETIME NULL,
    window_start VARCHAR(5) NOT NULL DEFAULT '09:00',
    window_end VARCHAR(5) NOT NULL DEFAULT '21:00',
    claimed_agent_uid INT NULL,
    source ENUM('route_step','queue_dtmf','queue_abandon') NOT NULL DEFAULT 'route_step',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (uid),
    INDEX idx_cc_callback_scan (vpbx_user_uid, status, next_attempt_at),
    INDEX idx_cc_callback_queue (vpbx_user_uid, queue_uid, status)
  )`,
];

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

  const qi: QueryInterface = sequelize.getQueryInterface();

  console.log('[migration] Creating cc_callback_requests...');
  await qi.createTable('cc_callback_requests', {
    uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    caller: { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' },
    route_uid: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    queue_uid: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    queue_name: { type: DataTypes.STRING(64), allowNull: true, defaultValue: null },
    step_id: { type: DataTypes.STRING(64), allowNull: true, defaultValue: null },
    uniqueid: { type: DataTypes.STRING(128), allowNull: true, defaultValue: null },
    status: {
      type: DataTypes.ENUM('pending', 'dialing', 'completed', 'failed', 'cancelled', 'expired'),
      allowNull: false,
      defaultValue: 'pending',
    },
    attempt_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    max_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    pause_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
    next_attempt_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    window_start: { type: DataTypes.STRING(5), allowNull: false, defaultValue: '09:00' },
    window_end: { type: DataTypes.STRING(5), allowNull: false, defaultValue: '21:00' },
    claimed_agent_uid: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    source: {
      type: DataTypes.ENUM('route_step', 'queue_dtmf', 'queue_abandon'),
      allowNull: false,
      defaultValue: 'route_step',
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('cc_callback_requests', ['vpbx_user_uid', 'status', 'next_attempt_at'], {
      name: 'idx_cc_callback_scan',
    });
  } catch (e) {
    console.log('[migration] idx_cc_callback_scan:', (e as Error).message);
  }

  try {
    await qi.addIndex('cc_callback_requests', ['vpbx_user_uid', 'queue_uid', 'status'], {
      name: 'idx_cc_callback_queue',
    });
  } catch (e) {
    console.log('[migration] idx_cc_callback_queue:', (e as Error).message);
  }

  try {
    await qi.addColumn('cc_settings', 'callback_policy', {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    });
  } catch (e) {
    console.log('[migration] cc_settings.callback_policy:', (e as Error).message);
  }

  try {
    await qi.addColumn('cc_callback_requests', 'queue_name', {
      type: DataTypes.STRING(64),
      allowNull: true,
      defaultValue: null,
    });
  } catch (e) {
    console.log('[migration] cc_callback_requests.queue_name:', (e as Error).message);
  }

  console.log('[migration] Phase 14 cc_callback_requests migration complete.');
  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
