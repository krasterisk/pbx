import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 7 wallboard migration (D-26 display tokens + D-28 alert routing).
 *
 * Standalone script (pattern: migrate-callcenter-settings-phase7.ts) — no
 * migration framework in this repo (app.module.ts: synchronize: false).
 *
 * 1. CREATE cc_display_tokens — opaque display tokens for TV wallboard (D-26).
 * 2. CREATE cc_alert_config — per-tenant alert routing singleton (D-28).
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-wallboard-phase7.ts
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

  console.log('[migration] Creating cc_display_tokens...');
  await qi.createTable('cc_display_tokens', {
    uid:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    token:         { type: DataTypes.STRING(64), allowNull: false },
    label:         { type: DataTypes.STRING(128), allowNull: true },
    created_by:    { type: DataTypes.INTEGER, allowNull: true },
    expires_at:    { type: DataTypes.DATE, allowNull: true },
    revoked_at:    { type: DataTypes.DATE, allowNull: true },
    last_used_at:  { type: DataTypes.DATE, allowNull: true },
    created_at:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('cc_display_tokens', ['token'], {
      name: 'idx_cc_display_tokens_token',
      unique: true,
    });
  } catch (e) {
    console.log('[migration] idx_cc_display_tokens_token:', (e as Error).message);
  }

  try {
    await qi.addIndex('cc_display_tokens', ['vpbx_user_uid'], {
      name: 'idx_cc_display_tokens_tenant',
    });
  } catch (e) {
    console.log('[migration] idx_cc_display_tokens_tenant:', (e as Error).message);
  }

  console.log('[migration] Creating cc_alert_config...');
  await qi.createTable('cc_alert_config', {
    uid:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    integration_uid: { type: DataTypes.INTEGER, allowNull: true },
    target:          { type: DataTypes.STRING(255), allowNull: true },
    enabled:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    cooldown_sec:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 300 },
    updated_at:      { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    vpbx_user_uid:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('cc_alert_config', ['vpbx_user_uid'], {
      name: 'idx_cc_alert_config_tenant',
      unique: true,
    });
  } catch (e) {
    console.log('[migration] idx_cc_alert_config_tenant:', (e as Error).message);
  }

  console.log('[migration] Phase 7 callcenter wallboard migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
