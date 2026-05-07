import { Sequelize } from 'sequelize';
import { DataTypes } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../../.env') });

async function main() {
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    logging: console.log,
  });

  const qi = sequelize.getQueryInterface();

  // ── billing_balances ──────────────────────────────────────────────────────
  console.log('[migration] Creating billing_balances...');
  await qi.createTable('billing_balances', {
    id:                   { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tenant_id:            { type: DataTypes.INTEGER, allowNull: false, unique: true },
    balance_kopecks:      { type: DataTypes.BIGINT, defaultValue: 0 },
    credit_limit_kopecks: { type: DataTypes.BIGINT, defaultValue: 0 },
    currency:             { type: DataTypes.STRING(3), defaultValue: 'RUB' },
    is_blocked:           { type: DataTypes.BOOLEAN, defaultValue: false },
    blocked_at:           { type: DataTypes.DATE, allowNull: true },
    updated_at:           { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);

  // ── billing_transactions ──────────────────────────────────────────────────
  console.log('[migration] Creating billing_transactions...');
  await qi.createTable('billing_transactions', {
    id:             { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    tenant_id:      { type: DataTypes.INTEGER, allowNull: false },
    type:           { type: DataTypes.ENUM('deposit','charge','refund','correction'), allowNull: false },
    amount_kopecks: { type: DataTypes.BIGINT, allowNull: false },
    balance_before: { type: DataTypes.BIGINT, allowNull: false },
    balance_after:  { type: DataTypes.BIGINT, allowNull: false },
    description:    { type: DataTypes.STRING(512), allowNull: true },
    module_code:    { type: DataTypes.STRING(64), allowNull: true },
    performed_by:   { type: DataTypes.INTEGER, allowNull: true },
    created_at:     { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);

  try { await qi.addIndex('billing_transactions', ['tenant_id', 'created_at'], { name: 'idx_bt_tenant_date' }); } catch {}
  try { await qi.addIndex('billing_balances', ['tenant_id'], { unique: true, name: 'idx_bb_tenant' }); } catch {}

  console.log('[migration] Billing tables created successfully ✅');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
