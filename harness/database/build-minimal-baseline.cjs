'use strict';
// Offline, reviewed extraction of neutral tables from immutable full baselines.
// The migration runner loads the generated SQL artifacts, never filters full SQL.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../packages/backend/database/migrations');
const tables = [
  'users', 'user_sessions', 'tenants', 'action_logs', 'roles',
  'modules_registry', 'tenant_modules', 'cc_ai_providers',
  'cloud_settings', 'hub_modules', 'hub_module_pages',
];
const tableSet = new Set(tables);
const pgTypes = [
  'enum_cc_ai_providers_kind', 'enum_cc_ai_providers_auth_type',
  'enum_modules_registry_category', 'enum_tenant_modules_status',
  'enum_tenant_modules_billing_cycle', 'enum_tenants_status',
  'enum_hub_modules_kind',
];
const pgTypeSet = new Set(pgTypes);

function extractMysql(sql) {
  const rows = new Map();
  for (const line of sql.split(/\r?\n/)) {
    const match = /^CREATE TABLE IF NOT EXISTS `([^`]+)`/.exec(line);
    if (match && tableSet.has(match[1])) rows.set(match[1], line);
  }
  if (rows.size !== tables.length) throw new Error('MySQL neutral table inventory changed');
  return `-- AI-01-C2 neutral schema extracted from immutable MySQL 0001.\n${tables.map(table => rows.get(table)).join('\n')}\n`;
}

function extractPostgres(sql) {
  const types = new Map();
  for (const line of sql.split(/\r?\n/)) {
    const match = /^CREATE TYPE "([^"]+)"/.exec(line);
    if (match && pgTypeSet.has(match[1])) types.set(match[1], line);
  }
  if (types.size !== pgTypes.length) throw new Error('PostgreSQL neutral type inventory changed');
  const create = tables.map(table => {
    const match = new RegExp(`CREATE TABLE "${table}" \\([\\s\\S]*?\\n\\);`).exec(sql);
    if (!match) throw new Error(`PostgreSQL neutral table ${table} missing`);
    return match[0];
  });
  const indexes = sql.split(/\r?\n/).filter(line => {
    const match = /^CREATE (?:UNIQUE )?INDEX "[^"]+" ON "([^"]+)"/.exec(line);
    return match && tableSet.has(match[1]);
  });
  const foreignKeys = sql.split(/\r?\n/).filter(line => {
    const match = /^ALTER TABLE "([^"]+)" ADD FOREIGN KEY .* REFERENCES "([^"]+)"/.exec(line);
    if (!match || !tableSet.has(match[1])) return false;
    if (!tableSet.has(match[2])) throw new Error(`Neutral table ${match[1]} references excluded ${match[2]}`);
    return true;
  });
  return `-- AI-01-C2 neutral schema extracted from reviewed PostgreSQL 0001.\n`
    + `DO $$ BEGIN IF current_setting('server_encoding') <> 'UTF8' THEN RAISE EXCEPTION 'Krasterisk requires UTF8 database encoding'; END IF; END $$;\n\n`
    + `${pgTypes.map(type => types.get(type)).join('\n')}\n\n${create.join('\n\n')}\n\n`
    + `${indexes.join('\n')}\n\n${foreignKeys.join('\n')}\n`;
}

function build() {
  const mysql = fs.readFileSync(path.join(root, '0001-current-schema.sql'), 'utf8');
  const postgres = fs.readFileSync(path.join(root, 'postgres/0001-current-schema.sql'), 'utf8');
  return { mysql: extractMysql(mysql), postgres: extractPostgres(postgres) };
}

if (require.main === module) {
  const artifacts = build();
  const names = { mysql: '0001-ai-standalone-base.sql', postgres: 'postgres/0001-ai-standalone-base.sql' };
  for (const [dialect, contents] of Object.entries(artifacts)) {
    const target = path.join(root, names[dialect]);
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(target, 'utf8') !== contents) throw new Error(`${dialect} minimal baseline drift`);
    } else {
      fs.writeFileSync(target, contents, 'utf8');
    }
  }
}

module.exports = { build, tables };
