import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

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

  // ── modules_registry ──────────────────────────────────────────────────────
  console.log('[migration] Creating modules_registry...');
  await qi.createTable('modules_registry', {
    id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code:           { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name:           { type: DataTypes.STRING(128), allowNull: false },
    description:    { type: DataTypes.TEXT, allowNull: true },
    version:        { type: DataTypes.STRING(16), defaultValue: '1.0.0' },
    category:       { type: DataTypes.ENUM('pbx','calls','analytics','integrations','admin'), defaultValue: 'pbx' },
    is_core:        { type: DataTypes.BOOLEAN, defaultValue: false },
    is_paid:        { type: DataTypes.BOOLEAN, defaultValue: false },
    price_monthly:  { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
    is_published:   { type: DataTypes.BOOLEAN, defaultValue: true },
    requires_cloud: { type: DataTypes.BOOLEAN, defaultValue: false },
    dependencies:   { type: DataTypes.JSON, defaultValue: '[]' },
    created_at:     { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);

  // ── tenant_modules ─────────────────────────────────────────────────────────
  console.log('[migration] Creating tenant_modules...');
  await qi.createTable('tenant_modules', {
    id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tenant_id:     { type: DataTypes.INTEGER, allowNull: false },
    module_code:   { type: DataTypes.STRING(64), allowNull: false },
    status:        { type: DataTypes.ENUM('active','inactive','trial','expired'), defaultValue: 'active' },
    activated_at:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    expires_at:    { type: DataTypes.DATE, allowNull: true },
    billing_cycle: { type: DataTypes.ENUM('monthly','yearly','lifetime'), defaultValue: 'monthly' },
    last_billed_at:{ type: DataTypes.DATE, allowNull: true },
    config:        { type: DataTypes.JSON, defaultValue: '{}' },
  }, { ifNotExists: true } as any);

  // Indexes
  try { await qi.addIndex('tenant_modules', ['tenant_id', 'module_code'], { unique: true, name: 'uq_tenant_module' }); } catch {}
  try { await qi.addIndex('tenant_modules', ['tenant_id'], { name: 'idx_tm_tenant' }); } catch {}
  try { await qi.addIndex('modules_registry', ['code'], { unique: true, name: 'idx_mr_code' }); } catch {}

  console.log('[migration] Phase 2 tables created successfully.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
