import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 7 call-center rollup migration (D-08) — Wave 2.
 *
 * Standalone script (pattern: migrate-call-groups-phase6.ts) — do NOT modify
 * migrate-callcenter-phase7.ts (07-01 owns cc_queue_calls).
 *
 * 1. CREATE cc_daily_queue_stats / cc_daily_agent_stats.
 * 2. UNIQUE + tenant-date indexes for idempotent upsert.
 * 3. Belt-and-suspenders: ensure raw cc_queue_calls composite indexes exist.
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-phase7-rollup.ts
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

  console.log('[migration] Creating cc_daily_queue_stats...');
  await qi.createTable('cc_daily_queue_stats', {
    uid:              { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    stat_date:        { type: DataTypes.DATEONLY, allowNull: false },
    queue_name:       { type: DataTypes.STRING(64), allowNull: false },
    total_calls:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    answered_calls:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    abandoned_calls:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    sla_met_calls:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    avg_wait_sec:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    avg_talk_sec:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    avg_hold_sec:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    max_wait_sec:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    total_talk_sec:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at:       { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    vpbx_user_uid:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('cc_daily_queue_stats', ['vpbx_user_uid', 'queue_name', 'stat_date'], {
      name: 'idx_cc_dqs_unique',
      unique: true,
    });
  } catch (e) {
    console.log('[migration] idx_cc_dqs_unique:', (e as Error).message);
  }

  try {
    await qi.addIndex('cc_daily_queue_stats', ['vpbx_user_uid', 'stat_date'], {
      name: 'idx_cc_dqs_tenant_date',
    });
  } catch (e) {
    console.log('[migration] idx_cc_dqs_tenant_date:', (e as Error).message);
  }

  console.log('[migration] Creating cc_daily_agent_stats...');
  await qi.createTable('cc_daily_agent_stats', {
    uid:              { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    stat_date:        { type: DataTypes.DATEONLY, allowNull: false },
    agent_interface:  { type: DataTypes.STRING(64), allowNull: false },
    agent_user_uid:   { type: DataTypes.INTEGER, allowNull: true },
    calls_handled:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    total_talk_sec:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    total_hold_sec:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    total_wrapup_sec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    avg_handle_sec:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at:       { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    vpbx_user_uid:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('cc_daily_agent_stats', ['vpbx_user_uid', 'agent_interface', 'stat_date'], {
      name: 'idx_cc_das_unique',
      unique: true,
    });
  } catch (e) {
    console.log('[migration] idx_cc_das_unique:', (e as Error).message);
  }

  try {
    await qi.addIndex('cc_daily_agent_stats', ['vpbx_user_uid', 'stat_date'], {
      name: 'idx_cc_das_tenant_date',
    });
  } catch (e) {
    console.log('[migration] idx_cc_das_tenant_date:', (e as Error).message);
  }

  // Belt-and-suspenders: ensure raw hybrid-strategy indexes from 07-01 exist
  try {
    await qi.addIndex('cc_queue_calls', ['vpbx_user_uid', 'created_at'], {
      name: 'idx_cc_queue_calls_tenant_date',
    });
  } catch (e) {
    console.log('[migration] idx_cc_queue_calls_tenant_date:', (e as Error).message);
  }

  try {
    await qi.addIndex('cc_queue_calls', ['vpbx_user_uid', 'queue_name', 'created_at'], {
      name: 'idx_cc_queue_calls_tenant_queue_date',
    });
  } catch (e) {
    console.log('[migration] idx_cc_queue_calls_tenant_queue_date:', (e as Error).message);
  }

  console.log('[migration] Phase 7 callcenter rollup migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
