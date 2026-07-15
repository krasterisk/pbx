import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 7 call-center migration (D-03) — Wave 1 history foundation.
 *
 * Standalone script (pattern: migrate-call-groups-phase6.ts) — no migration
 * framework in this repo (app.module.ts: synchronize: false).
 *
 * 1. CREATE cc_queue_calls — full queue-call history for reports/metrics.
 * 2. Indexes: tenant+date, tenant+queue+date, tenant+agent+date, UNIQUE call_uniqueid.
 *
 * Run (automated):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-phase7.ts (from packages/backend)
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

  console.log('[migration] Creating cc_queue_calls...');
  await qi.createTable('cc_queue_calls', {
    uid:              { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    call_uniqueid:    { type: DataTypes.STRING(64), allowNull: false },
    queue_name:       { type: DataTypes.STRING(64), allowNull: false },
    agent_interface:  { type: DataTypes.STRING(64), allowNull: true, defaultValue: '' },
    agent_user_uid:   { type: DataTypes.INTEGER, allowNull: true },
    caller_id_num:    { type: DataTypes.STRING(32), allowNull: false, defaultValue: '' },
    caller_id_name:   { type: DataTypes.STRING(128), allowNull: true, defaultValue: '' },
    enter_time:       { type: DataTypes.DATE, allowNull: true },
    answer_time:      { type: DataTypes.DATE, allowNull: true },
    end_time:         { type: DataTypes.DATE, allowNull: true },
    wait_time:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    talk_time:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    hold_time:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    wrapup_time:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    disposition:      {
      type: DataTypes.ENUM('answered', 'abandoned', 'transferred', 'timeout', 'other'),
      allowNull: false,
      defaultValue: 'other',
    },
    position:         { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at:       { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    vpbx_user_uid:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

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

  try {
    await qi.addIndex('cc_queue_calls', ['vpbx_user_uid', 'agent_user_uid', 'created_at'], {
      name: 'idx_cc_queue_calls_tenant_agent_date',
    });
  } catch (e) {
    console.log('[migration] idx_cc_queue_calls_tenant_agent_date:', (e as Error).message);
  }

  try {
    await qi.addIndex('cc_queue_calls', ['call_uniqueid'], {
      name: 'idx_cc_queue_calls_uniqueid',
      unique: true,
    });
  } catch (e) {
    console.log('[migration] idx_cc_queue_calls_uniqueid:', (e as Error).message);
  }

  console.log('[migration] Phase 7 callcenter cc_queue_calls migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
