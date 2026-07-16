import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 7 call-center report schedules migration (D-35).
 *
 * Standalone script (pattern: migrate-notifications-phase6.ts) — no migration
 * framework in this repo (app.module.ts: synchronize: false).
 *
 * Creates `cc_report_schedules` — tenant-scoped scheduled report delivery config.
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-report-schedules-phase7.ts
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

  console.log('[migration] Creating cc_report_schedules...');
  await qi.createTable('cc_report_schedules', {
    uid:              { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    name:             { type: DataTypes.STRING(128), allowNull: false },
    report_id:        { type: DataTypes.STRING(32), allowNull: false },
    format:           { type: DataTypes.ENUM('csv', 'xlsx'), allowNull: false, defaultValue: 'xlsx' },
    period_preset:    {
      type: DataTypes.ENUM('today', 'yesterday', 'last-7-days', 'last-30-days', 'previous-month'),
      allowNull: false,
      defaultValue: 'yesterday',
    },
    filters:          { type: DataTypes.JSON, allowNull: true },
    frequency:        { type: DataTypes.ENUM('daily', 'weekly', 'monthly'), allowNull: false, defaultValue: 'daily' },
    hour:             { type: DataTypes.INTEGER, allowNull: false, defaultValue: 8 },
    minute:           { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    day_of_week:      { type: DataTypes.INTEGER, allowNull: true },
    day_of_month:     { type: DataTypes.INTEGER, allowNull: true },
    integration_uid:  { type: DataTypes.INTEGER, allowNull: false },
    target:           { type: DataTypes.STRING(256), allowNull: true },
    subject_template: { type: DataTypes.STRING(256), allowNull: true },
    message_template: { type: DataTypes.TEXT, allowNull: true },
    enabled:          { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    last_run_at:      { type: DataTypes.DATE, allowNull: true },
    last_status:      { type: DataTypes.STRING(16), allowNull: true },
    last_error:       { type: DataTypes.STRING(512), allowNull: true },
    next_run_at:      { type: DataTypes.DATE, allowNull: true },
    vpbx_user_uid:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('cc_report_schedules', ['vpbx_user_uid'], {
      name: 'idx_cc_report_sched_user_uid',
    });
  } catch (e) {
    console.log('[migration] idx_cc_report_sched_user_uid:', (e as Error).message);
  }

  try {
    await qi.addIndex('cc_report_schedules', ['enabled', 'next_run_at'], {
      name: 'idx_cc_report_sched_due',
    });
  } catch (e) {
    console.log('[migration] idx_cc_report_sched_due:', (e as Error).message);
  }

  console.log('[migration] Phase 7 callcenter report schedules migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
