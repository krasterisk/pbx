import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface, QueryTypes } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  HUB_MODULES_SEED,
  HUB_MODULE_PAGES_SEED,
} from './hub-modules.seed';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 8 Hub catalog migration (D-12, D-15, D-19, D-04).
 *
 * Standalone script (pattern: migrate-call-groups-phase6.ts) — synchronize: false.
 *
 * 1. CREATE hub_modules + hub_module_pages (additive; keeps modules_registry)
 * 2. CREATE role_start_defaults + tenant_role_start
 * 3. Seed Hub baseline membership (idempotent upsert)
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/cloud-admin/migrate-hub-modules-phase8.ts
 */
async function tableExists(qi: QueryInterface, table: string): Promise<boolean> {
  const tables = await qi.showAllTables();
  const names = tables.map((t) => (typeof t === 'string' ? t : (t as any).tableName ?? String(t)));
  return names.includes(table);
}

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

  console.log('[migration] Creating hub_modules...');
  await qi.createTable('hub_modules', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(128), allowNull: false },
    kind: { type: DataTypes.ENUM('base', 'market'), allowNull: false, defaultValue: 'base' },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    requires_cloud: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, { ifNotExists: true } as any);

  console.log('[migration] Creating hub_module_pages...');
  await qi.createTable('hub_module_pages', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    hub_code: { type: DataTypes.STRING(64), allowNull: false },
    page_code: { type: DataTypes.STRING(64), allowNull: false },
    path: { type: DataTypes.STRING(255), allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('hub_module_pages', ['hub_code', 'page_code'], {
      unique: true,
      name: 'uq_hub_module_page',
    });
  } catch (e) {
    console.log('[migration] uq_hub_module_page:', (e as Error).message);
  }

  try {
    await qi.addIndex('hub_module_pages', ['hub_code'], { name: 'idx_hub_module_pages_hub' });
  } catch (e) {
    console.log('[migration] idx_hub_module_pages_hub:', (e as Error).message);
  }

  console.log('[migration] Creating role_start_defaults...');
  await qi.createTable('role_start_defaults', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_level: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    start_path: { type: DataTypes.STRING(255), allowNull: false },
  }, { ifNotExists: true } as any);

  console.log('[migration] Creating tenant_role_start...');
  await qi.createTable('tenant_role_start', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    user_level: { type: DataTypes.INTEGER, allowNull: false },
    start_path: { type: DataTypes.STRING(255), allowNull: false },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('tenant_role_start', ['tenant_id', 'user_level'], {
      unique: true,
      name: 'uq_tenant_role_start',
    });
  } catch (e) {
    console.log('[migration] uq_tenant_role_start:', (e as Error).message);
  }

  // ── Idempotent seed ─────────────────────────────────────────────────────
  console.log('[migration] Seeding hub_modules...');
  for (const mod of HUB_MODULES_SEED) {
    const existing = await sequelize.query<{ id: number }>(
      'SELECT id FROM hub_modules WHERE code = :code LIMIT 1',
      { replacements: { code: mod.code }, type: QueryTypes.SELECT },
    );
    if (existing.length === 0) {
      await sequelize.query(
        `INSERT INTO hub_modules (code, name, kind, sort_order, requires_cloud)
         VALUES (:code, :name, :kind, :sort_order, :requires_cloud)`,
        {
          replacements: {
            code: mod.code,
            name: mod.name,
            kind: mod.kind,
            sort_order: mod.sort_order,
            requires_cloud: mod.requires_cloud ? 1 : 0,
          },
        },
      );
    } else {
      await sequelize.query(
        `UPDATE hub_modules SET name = :name, kind = :kind, sort_order = :sort_order,
         requires_cloud = :requires_cloud WHERE code = :code`,
        {
          replacements: {
            code: mod.code,
            name: mod.name,
            kind: mod.kind,
            sort_order: mod.sort_order,
            requires_cloud: mod.requires_cloud ? 1 : 0,
          },
        },
      );
    }
  }

  console.log('[migration] Seeding hub_module_pages...');
  for (const page of HUB_MODULE_PAGES_SEED) {
    const existing = await sequelize.query<{ id: number }>(
      'SELECT id FROM hub_module_pages WHERE hub_code = :hub_code AND page_code = :page_code LIMIT 1',
      {
        replacements: { hub_code: page.hub_code, page_code: page.page_code },
        type: QueryTypes.SELECT,
      },
    );
    if (existing.length === 0) {
      await sequelize.query(
        `INSERT INTO hub_module_pages (hub_code, page_code, path, sort_order)
         VALUES (:hub_code, :page_code, :path, :sort_order)`,
        {
          replacements: {
            hub_code: page.hub_code,
            page_code: page.page_code,
            path: page.path,
            sort_order: page.sort_order,
          },
        },
      );
    } else {
      await sequelize.query(
        `UPDATE hub_module_pages SET path = :path, sort_order = :sort_order
         WHERE hub_code = :hub_code AND page_code = :page_code`,
        {
          replacements: {
            hub_code: page.hub_code,
            page_code: page.page_code,
            path: page.path,
            sort_order: page.sort_order,
          },
        },
      );
    }
  }

  // Seed D-16 platform role→start defaults (idempotent)
  const roleDefaults: Array<{ user_level: number; start_path: string }> = [
    { user_level: 2, start_path: '/callcenter/agent' },      // OPERATOR
    { user_level: 3, start_path: '/callcenter/supervisor' }, // SUPERVISOR
    { user_level: 1, start_path: '/' },                      // ADMIN
    { user_level: 0, start_path: '/' },                      // SUPERADMIN
    { user_level: 5, start_path: '/' },                      // READONLY
  ];
  console.log('[migration] Seeding role_start_defaults...');
  for (const row of roleDefaults) {
    const existing = await sequelize.query<{ id: number }>(
      'SELECT id FROM role_start_defaults WHERE user_level = :user_level LIMIT 1',
      { replacements: { user_level: row.user_level }, type: QueryTypes.SELECT },
    );
    if (existing.length === 0) {
      await sequelize.query(
        `INSERT INTO role_start_defaults (user_level, start_path) VALUES (:user_level, :start_path)`,
        { replacements: row },
      );
    }
  }

  const hasHub = await tableExists(qi, 'hub_modules');
  const hasPages = await tableExists(qi, 'hub_module_pages');
  console.log(`[migration] Phase 8 Hub migration complete (hub_modules=${hasHub}, hub_module_pages=${hasPages}).`);
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
