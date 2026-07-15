import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 7 call-center settings migration (D-22, D-27).
 *
 * Standalone script (pattern: migrate-call-groups-phase6.ts) — no migration
 * framework in this repo (app.module.ts: synchronize: false).
 *
 * 1. CREATE cc_operator_settings — per-operator settings (D-16/18/19/20 → D-22).
 * 2. CREATE cc_settings — per-tenant singleton (D-07 default SLA + D-27 thresholds).
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-settings-phase7.ts
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

  console.log('[migration] Creating cc_operator_settings...');
  await qi.createTable('cc_operator_settings', {
    uid:                    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    operator_user_id:       { type: DataTypes.INTEGER, allowNull: false },
    pickup_enabled:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    auto_answer:            { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    auto_answer_zip_tone:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    wrapup_timeout:         { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
    wrapup_extend_step:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
    wrapup_autosave_draft:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sound_incoming:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sound_missed:           { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    notifications_enabled:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    volume:                 { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
    updated_at:             { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    vpbx_user_uid:          { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('cc_operator_settings', ['vpbx_user_uid', 'operator_user_id'], {
      name: 'idx_cc_operator_settings_tenant_operator',
      unique: true,
    });
  } catch (e) {
    console.log('[migration] idx_cc_operator_settings_tenant_operator:', (e as Error).message);
  }

  console.log('[migration] Creating cc_settings...');
  await qi.createTable('cc_settings', {
    uid:                    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    default_sla_threshold:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 20 },
    alert_thresholds:       { type: DataTypes.JSON, allowNull: true },
    alert_sound_enabled:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    updated_at:             { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    vpbx_user_uid:          { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('cc_settings', ['vpbx_user_uid'], {
      name: 'idx_cc_settings_tenant',
      unique: true,
    });
  } catch (e) {
    console.log('[migration] idx_cc_settings_tenant:', (e as Error).message);
  }

  console.log('[migration] Phase 7 callcenter settings migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
