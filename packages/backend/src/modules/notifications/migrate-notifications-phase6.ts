import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 6 notification integrations migration (D-10, D-11).
 *
 * Standalone script (pattern: migrate-phonebooks-phase5.ts) — no migration
 * framework in this repo (app.module.ts: synchronize: false).
 *
 * Creates `notification_integrations` — tenant-scoped credential store for
 * multi-channel notify apps (telegram, email, whatsapp, webhook, max, vk).
 *
 * Run (automated):
 *   npx ts-node src/modules/notifications/migrate-notifications-phase6.ts (from packages/backend)
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

  console.log('[migration] Creating notification_integrations...');
  await qi.createTable('notification_integrations', {
    uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(128), allowNull: false },
    channel: {
      type: DataTypes.ENUM('telegram', 'email', 'whatsapp', 'webhook', 'max', 'vk'),
      allowNull: false,
    },
    config: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    encrypted_credentials: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('notification_integrations', ['user_uid'], { name: 'idx_notif_int_user_uid' });
  } catch (e) {
    console.log('[migration] idx_notif_int_user_uid:', (e as Error).message);
  }

  console.log('[migration] Phase 6 notification integrations migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
