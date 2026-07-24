import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 10 softphone shared contact book (D-11…D-15).
 *
 * Standalone script — no migration framework (app.module.ts: synchronize: false).
 * Apply to live DB before frontend Book section consumes GET /callcenter/contacts.
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-contacts.ts
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

  console.log('[migration] Creating cc_contacts...');
  await qi.createTable(
    'cc_contacts',
    {
      uid: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      created_by: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING(128), allowNull: false },
      number: { type: DataTypes.STRING(64), allowNull: false },
      note: { type: DataTypes.STRING(255), allowNull: true, defaultValue: null },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { ifNotExists: true } as any,
  );

  try {
    await qi.addIndex('cc_contacts', ['vpbx_user_uid'], { name: 'idx_cc_contacts_user_uid' });
  } catch (e) {
    console.log('[migration] idx_cc_contacts_user_uid:', (e as Error).message);
  }

  try {
    await qi.addIndex('cc_contacts', ['created_by'], { name: 'idx_cc_contacts_created_by' });
  } catch (e) {
    console.log('[migration] idx_cc_contacts_created_by:', (e as Error).message);
  }

  await sequelize.close();
  console.log('[migration] cc_contacts done.');
}

main().catch((err) => {
  console.error('[migration] failed:', err);
  process.exit(1);
});
