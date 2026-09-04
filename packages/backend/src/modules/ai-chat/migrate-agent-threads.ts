import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 15 agent-thread persistence (D-26 / D-08).
 *
 * Standalone script (pattern: migrate-voicemail.ts) — no migration
 * framework in this repo (app.module.ts: synchronize: false).
 *
 * Creates ai_agent_threads, ai_agent_thread_messages, ai_agent_proposals
 * and adds cc_ai_audit_log.thread_uid. Re-runs are safe (create-if-absent,
 * guarded indexes and addColumn).
 *
 * Run:
 *   npm run db:setup:agent-threads -w @krasterisk/backend
 */
async function addIndexGuarded(
  qi: QueryInterface,
  table: string,
  fields: string[],
  options: { name: string },
): Promise<void> {
  try {
    await qi.addIndex(table, fields, options);
    console.log(`[migration] index ${options.name}`);
  } catch (e) {
    console.log(`[migration] ${options.name}:`, (e as Error).message);
  }
}

async function main() {
  const sequelize = new Sequelize({
    dialect: (process.env.DB_DIALECT as 'mysql' | 'postgres') || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'krasterisk',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'krasterisk',
    logging: console.log,
  });

  const qi: QueryInterface = sequelize.getQueryInterface();

  console.log('[migration] Creating ai_agent_threads...');
  await qi.createTable('ai_agent_threads', {
    uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false },
    user_uid: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },
    provider_uid: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    tokens_in: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    tokens_out: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_message_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);
  console.log('[migration] table ai_agent_threads');

  await addIndexGuarded(qi, 'ai_agent_threads', ['vpbx_user_uid', 'user_uid', 'last_message_at'], {
    name: 'idx_ai_agent_threads_scope',
  });

  console.log('[migration] Creating ai_agent_thread_messages...');
  await qi.createTable('ai_agent_thread_messages', {
    uid: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    thread_uid: { type: DataTypes.INTEGER, allowNull: false },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false },
    role: { type: DataTypes.STRING(16), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    tool_name: { type: DataTypes.STRING(128), allowNull: true, defaultValue: null },
    tool_calls: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    proposal_id: { type: DataTypes.CHAR(36), allowNull: true, defaultValue: null },
    tokens_in: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    tokens_out: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);
  console.log('[migration] table ai_agent_thread_messages');

  await addIndexGuarded(qi, 'ai_agent_thread_messages', ['thread_uid', 'uid'], {
    name: 'idx_ai_agent_thread_messages_thread',
  });

  console.log('[migration] Creating ai_agent_proposals...');
  await qi.createTable('ai_agent_proposals', {
    proposal_id: { type: DataTypes.CHAR(36), primaryKey: true },
    thread_uid: { type: DataTypes.INTEGER, allowNull: false },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false },
    user_uid: { type: DataTypes.INTEGER, allowNull: false },
    entity_type: { type: DataTypes.STRING(64), allowNull: false },
    entity_label: { type: DataTypes.STRING(255), allowNull: false },
    summary: { type: DataTypes.JSON, allowNull: false },
    before_json: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    after_json: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    apply_payload: { type: DataTypes.JSON, allowNull: false },
    includes_dialplan_reload: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
    error: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    applied_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);
  console.log('[migration] table ai_agent_proposals');

  await addIndexGuarded(qi, 'ai_agent_proposals', ['vpbx_user_uid', 'status', 'expires_at'], {
    name: 'idx_ai_agent_proposals_scope',
  });

  console.log('[migration] Adding cc_ai_audit_log.thread_uid...');
  try {
    await qi.addColumn('cc_ai_audit_log', 'thread_uid', {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
    console.log('[migration] column cc_ai_audit_log.thread_uid');
  } catch (e) {
    console.log('[migration] cc_ai_audit_log.thread_uid:', (e as Error).message);
  }

  console.log('[migration] Phase 15 agent threads + proposals + audit link complete.');
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
