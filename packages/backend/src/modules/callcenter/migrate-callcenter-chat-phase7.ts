import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 7 internal chat migration (D-30, D-31, D-32).
 *
 * Creates cc_chat_messages + cc_chat_channels with tenant isolation indexes.
 *
 * Run: npx ts-node src/modules/callcenter/migrate-callcenter-chat-phase7.ts (from packages/backend)
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

  console.log('[migration] Creating cc_chat_messages...');
  await qi.createTable('cc_chat_messages', {
    uid: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    channel_key: { type: DataTypes.STRING(128), allowNull: false },
    channel_type: {
      type: DataTypes.ENUM('direct', 'group', 'broadcast_all', 'broadcast_queue'),
      allowNull: false,
    },
    sender_user_id: { type: DataTypes.INTEGER, allowNull: false },
    sender_name: { type: DataTypes.STRING(128), allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  console.log('[migration] Creating cc_chat_channels...');
  await qi.createTable('cc_chat_channels', {
    uid: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    channel_key: { type: DataTypes.STRING(128), allowNull: false },
    type: {
      type: DataTypes.ENUM('direct', 'group', 'broadcast_all', 'broadcast_queue'),
      allowNull: false,
    },
    name: { type: DataTypes.STRING(128), allowNull: true },
    member_user_ids: { type: DataTypes.JSON, allowNull: true },
    queue_name: { type: DataTypes.STRING(64), allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('cc_chat_messages', ['vpbx_user_uid', 'channel_key', 'created_at'], {
      name: 'idx_cc_chat_msg_tenant_channel_date',
    });
  } catch (e) {
    console.log('[migration] idx_cc_chat_msg_tenant_channel_date:', (e as Error).message);
  }

  try {
    await qi.addIndex('cc_chat_channels', ['vpbx_user_uid', 'channel_key'], {
      name: 'idx_cc_chat_chan_tenant_key',
    });
  } catch (e) {
    console.log('[migration] idx_cc_chat_chan_tenant_key:', (e as Error).message);
  }

  console.log('[migration] Phase 7 call center chat migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
