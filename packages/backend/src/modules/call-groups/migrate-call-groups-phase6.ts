import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 6 call-groups migration (D-01, D-03, D-06, D-07).
 *
 * Standalone script (pattern: migrate-phonebooks-phase5.ts) — no migration
 * framework in this repo (app.module.ts: synchronize: false).
 *
 * 1. CREATE call_groups — tenant-scoped ring-group entity.
 * 2. CREATE call_group_members — ordered members with per-member ring_time.
 *
 * Run (automated):
 *   npx ts-node src/modules/call-groups/migrate-call-groups-phase6.ts (from packages/backend)
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

  console.log('[migration] Creating call_groups...');
  await qi.createTable('call_groups', {
    uid:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name:              { type: DataTypes.STRING(128), allowNull: false },
    strategy:          { type: DataTypes.ENUM('ringall', 'hunt', 'memoryhunt', 'random'), allowNull: false },
    ring_time:         { type: DataTypes.INTEGER, allowNull: false, defaultValue: 25 },
    external_context:  { type: DataTypes.STRING(128), allowNull: true, defaultValue: null },
    cid_prefix:        { type: DataTypes.STRING(64), allowNull: true, defaultValue: null },
    vpbx_user_uid:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('call_groups', ['vpbx_user_uid'], { name: 'idx_call_groups_user_uid' });
  } catch (e) {
    console.log('[migration] idx_call_groups_user_uid:', (e as Error).message);
  }

  console.log('[migration] Creating call_group_members...');
  await qi.createTable('call_group_members', {
    uid:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    call_group_uid:  { type: DataTypes.INTEGER, allowNull: false },
    member_type:     { type: DataTypes.ENUM('internal', 'external'), allowNull: false },
    value:           { type: DataTypes.STRING(128), allowNull: false },
    position:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ring_time:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 20 },
    vpbx_user_uid:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('call_group_members', ['vpbx_user_uid'], { name: 'idx_call_group_members_user_uid' });
  } catch (e) {
    console.log('[migration] idx_call_group_members_user_uid:', (e as Error).message);
  }

  try {
    await qi.addIndex('call_group_members', ['call_group_uid'], { name: 'idx_call_group_members_group_uid' });
  } catch (e) {
    console.log('[migration] idx_call_group_members_group_uid:', (e as Error).message);
  }

  try {
    await sequelize.query(
      'ALTER TABLE call_group_members ADD CONSTRAINT fk_cgm_call_group FOREIGN KEY (call_group_uid) REFERENCES call_groups(uid) ON DELETE CASCADE',
    );
  } catch (e) {
    console.log('[migration] fk_cgm_call_group already exists or failed:', (e as Error).message);
  }

  console.log('[migration] Phase 6 call-groups migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
