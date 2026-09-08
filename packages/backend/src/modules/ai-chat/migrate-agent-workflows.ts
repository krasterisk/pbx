import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

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

  await qi.createTable(
    'ai_agent_workflows',
    {
      uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      workflow_id: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
      thread_uid: { type: DataTypes.INTEGER, allowNull: false },
      vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false },
      user_uid: { type: DataTypes.INTEGER, allowNull: false },
      brief_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      title: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
      summary: { type: DataTypes.JSON, allowNull: false },
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
      error: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      applied_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { ifNotExists: true } as any,
  );

  await addIndexGuarded(qi, 'ai_agent_workflows', ['vpbx_user_uid', 'user_uid', 'status'], {
    name: 'idx_ai_agent_workflows_scope',
  });

  await qi.createTable(
    'ai_agent_workflow_steps',
    {
      uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      workflow_uid: { type: DataTypes.INTEGER, allowNull: false },
      step_key: { type: DataTypes.STRING(64), allowNull: false },
      step_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      tool: { type: DataTypes.STRING(128), allowNull: false },
      entity_type: { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' },
      entity_label: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
      depends_on: { type: DataTypes.JSON, allowNull: false },
      canonical_args: { type: DataTypes.JSON, allowNull: false },
      schema_version: { type: DataTypes.STRING(64), allowNull: false },
      before_json: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
      after_json: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
      result_json: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      error: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
      requires_secure_input: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { ifNotExists: true } as any,
  );

  await addIndexGuarded(qi, 'ai_agent_workflow_steps', ['workflow_uid', 'step_index'], {
    name: 'idx_ai_agent_workflow_steps_order',
  });

  console.log('[migration] agent workflows complete.');
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
