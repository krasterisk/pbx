import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const TABLE = 'tenant_settings';
const UNIQ_INDEX = 'tenant_settings_vpbx_key_uniq';

function tableNames(tables: unknown[]): string[] {
  return tables.map((t) => (typeof t === 'string' ? t : ((t as { tableName?: string }).tableName ?? String(t))));
}

function indexNames(indexes: Array<{ name?: string; Name?: string }>): string[] {
  return indexes.map((i) => i.name ?? i.Name ?? '');
}

/**
 * Idempotent tenant_settings DDL (D-19). Does not backfill rows —
 * missing key means TENANT_SETTING_KEYS default (D-17: both ON / true).
 */
export async function runTenantSettingsMigrate(queryInterface: QueryInterface): Promise<void> {
  const tables = tableNames(await queryInterface.showAllTables());
  if (!tables.includes(TABLE)) {
    console.log('[migration] Creating tenant_settings...');
    await queryInterface.createTable(TABLE, {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false },
      key: { type: DataTypes.STRING(128), allowNull: false },
      value: { type: DataTypes.TEXT, allowNull: true },
      category: { type: DataTypes.STRING(64), defaultValue: 'general' },
    });
  } else {
    console.log('[migration] tenant_settings already exists — skip createTable');
  }

  const indexes = indexNames(
    (await queryInterface.showIndex(TABLE)) as Array<{ name?: string; Name?: string }>,
  );
  if (!indexes.includes(UNIQ_INDEX)) {
    console.log(`[migration] Adding ${UNIQ_INDEX}...`);
    await queryInterface.addIndex(TABLE, ['vpbx_user_uid', 'key'], {
      unique: true,
      name: UNIQ_INDEX,
    });
  } else {
    console.log(`[migration] ${UNIQ_INDEX} already exists — skip addIndex`);
  }
}

async function main(): Promise<void> {
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
    await runTenantSettingsMigrate(sequelize.getQueryInterface());
    console.log('[migration] tenant_settings migrate complete.');
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
