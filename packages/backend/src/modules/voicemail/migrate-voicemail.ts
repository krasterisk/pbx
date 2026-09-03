import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 13 voicemail_messages migration (D-60 / D-72 / D-73).
 *
 * Standalone script (pattern: migrate-notifications-phase6.ts) — no migration
 * framework in this repo (app.module.ts: synchronize: false).
 *
 * Two-axis statuses: notify_status + transcript_status. No file janitor (D-73).
 *
 * Run (automated):
 *   npx ts-node src/modules/voicemail/migrate-voicemail.ts (from packages/backend)
 */
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

  console.log('[migration] Creating voicemail_messages...');
  await qi.createTable('voicemail_messages', {
    uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    uniqueid: { type: DataTypes.STRING(128), allowNull: false },
    file_rel: { type: DataTypes.STRING(512), allowNull: false },
    record_status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: '' },
    caller_id: { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' },
    exten: { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' },
    duration_sec: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    notify_status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
    transcript_status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
    notify_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    transcript_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    next_notify_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    scan_locked_until: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    transcript: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    summary: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    notify_error: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    notify_dispatch: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);

  try {
    await qi.addColumn('voicemail_messages', 'notify_dispatch', {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    });
  } catch (e) {
    console.log('[migration] notify_dispatch:', (e as Error).message);
  }

  try {
    await qi.addIndex('voicemail_messages', ['vpbx_user_uid', 'uniqueid'], {
      name: 'uq_voicemail_messages_tenant_uniqueid',
      unique: true,
    });
  } catch (e) {
    console.log('[migration] uq_voicemail_messages_tenant_uniqueid:', (e as Error).message);
  }

  console.log('[migration] Creating vm_access_tokens...');
  await qi.createTable('vm_access_tokens', {
    uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    token: { type: DataTypes.STRING(64), allowNull: false },
    message_uid: { type: DataTypes.INTEGER, allowNull: false },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('vm_access_tokens', ['token'], {
      name: 'uq_vm_access_tokens_token',
      unique: true,
    });
  } catch (e) {
    console.log('[migration] uq_vm_access_tokens_token:', (e as Error).message);
  }

  console.log('[migration] Phase 13 voicemail_messages + vm_access_tokens migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
