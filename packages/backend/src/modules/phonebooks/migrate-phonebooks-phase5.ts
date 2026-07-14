import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 5 phonebooks migration (D-04, D-05, D-07, D-25).
 *
 * Standalone script (pattern: cloud-admin/migrate-phase2.ts) — no migration
 * framework in this repo (app.module.ts: synchronize: false).
 *
 * 1. CREATE route_phonebook_bindings — new binding entity (route_uid + phonebook_uid
 *    + position + match_mode + behavior_type/params/actions + user_uid).
 * 2. CREATE ai_chat_settings — per-tenant AI confirmation settings (needed by plan 05-02,
 *    D-25 default OFF); created here so the phase ships with a single migration.
 * 3. ALTER route_phonebooks DROP invert, actions — behavior moves to bindings (D-04).
 *    No data conversion needed — D-07: no phonebooks exist in production yet.
 *
 * Run: npx ts-node src/modules/phonebooks/migrate-phonebooks-phase5.ts (from packages/backend)
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

  // ── route_phonebook_bindings ─────────────────────────────────────────────
  console.log('[migration] Creating route_phonebook_bindings...');
  await qi.createTable('route_phonebook_bindings', {
    uid:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    route_uid:       { type: DataTypes.INTEGER, allowNull: false },
    phonebook_uid:   { type: DataTypes.INTEGER, allowNull: false },
    position:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    match_mode:      { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'on_match' },
    behavior_type:   { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'vars_only' },
    behavior_params: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    actions:         { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    user_uid:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at:      { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at:      { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);

  try { await qi.addIndex('route_phonebook_bindings', ['route_uid'], { name: 'idx_pb_bind_route' }); } catch (e) { console.log('[migration] idx_pb_bind_route:', (e as Error).message); }
  try { await qi.addIndex('route_phonebook_bindings', ['phonebook_uid'], { name: 'idx_pb_bind_pb' }); } catch (e) { console.log('[migration] idx_pb_bind_pb:', (e as Error).message); }
  try { await qi.addIndex('route_phonebook_bindings', ['user_uid'], { name: 'idx_pbb_user_uid' }); } catch (e) { console.log('[migration] idx_pbb_user_uid:', (e as Error).message); }

  try {
    await sequelize.query(
      'ALTER TABLE route_phonebook_bindings ADD CONSTRAINT fk_pbb_route FOREIGN KEY (route_uid) REFERENCES routes(uid) ON DELETE CASCADE',
    );
  } catch (e) { console.log('[migration] fk_pbb_route already exists or failed:', (e as Error).message); }

  try {
    await sequelize.query(
      'ALTER TABLE route_phonebook_bindings ADD CONSTRAINT fk_pbb_pb FOREIGN KEY (phonebook_uid) REFERENCES route_phonebooks(uid) ON DELETE CASCADE',
    );
  } catch (e) { console.log('[migration] fk_pbb_pb already exists or failed:', (e as Error).message); }

  // ── ai_chat_settings (per-tenant AI confirmation settings, D-25) ─────────
  console.log('[migration] Creating ai_chat_settings...');
  await qi.createTable('ai_chat_settings', {
    uid:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_uid:            { type: DataTypes.INTEGER, allowNull: false, unique: true },
    confirm_destructive: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    settings:            { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    created_at:          { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at:          { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);

  try { await qi.addIndex('ai_chat_settings', ['user_uid'], { name: 'idx_ai_chat_settings_user_uid' }); } catch (e) { console.log('[migration] idx_ai_chat_settings_user_uid:', (e as Error).message); }

  // ── route_phonebooks: drop legacy behavior columns (D-04, D-07) ──────────
  console.log('[migration] Dropping route_phonebooks.invert / .actions (behavior moves to bindings)...');
  try { await qi.removeColumn('route_phonebooks', 'invert'); } catch (e) { console.log('[migration] invert column already dropped or missing:', (e as Error).message); }
  try { await qi.removeColumn('route_phonebooks', 'actions'); } catch (e) { console.log('[migration] actions column already dropped or missing:', (e as Error).message); }

  console.log('[migration] Phase 5 phonebooks migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
