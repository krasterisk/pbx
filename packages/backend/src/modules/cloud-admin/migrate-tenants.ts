import { QueryInterface, DataTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Run this script once to create the tenants table:
 *   npx ts-node packages/backend/src/modules/cloud-admin/migrate-tenants.ts
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

  console.log('[migration] Creating tenants table...');

  await qi.createTable('tenants', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    uid: { type: DataTypes.STRING(36), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    slug: { type: DataTypes.STRING(128), allowNull: true, unique: true },
    owner_user_id: { type: DataTypes.INTEGER, allowNull: false },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    status: {
      type: DataTypes.ENUM('trial', 'active', 'suspended', 'cancelled'),
      allowNull: false,
      defaultValue: 'trial',
    },
    trial_ends_at: { type: DataTypes.DATE, allowNull: true },
    email: { type: DataTypes.STRING(255), allowNull: true },
    phone: { type: DataTypes.STRING(32), allowNull: true },
    company_inn: { type: DataTypes.STRING(32), allowNull: true },
    max_extensions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    max_trunks: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2 },
    max_queues: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);

  try { await qi.addIndex('tenants', ['status'], { name: 'idx_tenants_status' }); } catch {}
  try { await qi.addIndex('tenants', ['owner_user_id'], { name: 'idx_tenants_owner' }); } catch {}
  try { await qi.addIndex('tenants', ['vpbx_user_uid'], { name: 'idx_tenants_vpbx' }); } catch {}

  console.log('[migration] tenants table created successfully.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('[migration] FAILED:', err);
  process.exit(1);
});
