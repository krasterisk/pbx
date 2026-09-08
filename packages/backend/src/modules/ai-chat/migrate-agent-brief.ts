import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Conversation brief + tool replay columns for ai_agent_threads / messages.
 * Idempotent addColumn. Run:
 *   npm run db:setup:agent-brief -w @krasterisk/backend
 */
async function addColumnGuarded(
  qi: QueryInterface,
  table: string,
  column: string,
  spec: Record<string, unknown>,
): Promise<void> {
  try {
    await qi.addColumn(table, column, spec as any);
    console.log(`[migration] ${table}.${column}`);
  } catch (e) {
    console.log(`[migration] ${table}.${column}:`, (e as Error).message);
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

  await addColumnGuarded(qi, 'ai_agent_threads', 'brief_json', {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
  });
  await addColumnGuarded(qi, 'ai_agent_threads', 'brief_version', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  });
  await addColumnGuarded(qi, 'ai_agent_threads', 'brief_updated_through_message_uid', {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: null,
  });

  await addColumnGuarded(qi, 'ai_agent_thread_messages', 'tool_call_id', {
    type: DataTypes.STRING(128),
    allowNull: true,
    defaultValue: null,
  });
  await addColumnGuarded(qi, 'ai_agent_thread_messages', 'provider_model', {
    type: DataTypes.STRING(128),
    allowNull: true,
    defaultValue: null,
  });

  console.log('[migration] agent brief + tool replay columns complete.');
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
