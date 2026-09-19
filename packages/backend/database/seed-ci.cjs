'use strict';

// A one-shot fixture for disposable CI databases. It never updates an existing account.
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { resolveDatabaseConfig, toDriverConfig } = require('../src/database/database-config.cjs');
const { checkSchemaReadiness } = require('../src/database/schema-readiness.cjs');

function assertDisposable(input) {
  if (input.CI !== 'true' || !/^krasterisk_ci(?:_[a-z0-9]+)?$/.test(input.DB_NAME || '')) {
    throw new Error('CI fixture requires CI=true and DB_NAME=krasterisk_ci[_suffix]');
  }
  if (!input.CI_SEED_PASSWORD || input.CI_SEED_PASSWORD.length < 12) {
    throw new Error('CI_SEED_PASSWORD must contain at least 12 characters');
  }
}

async function connect(config) {
  if (config.dialect === 'mysql') {
    const db = await mysql.createConnection(toDriverConfig(config));
    await db.query('SET time_zone = ?', [config.timezone]);
    return {
      query: async (sql, values = []) => (await db.query(sql.replace(/\$\d+/g, '?'), values))[0],
      close: () => db.end(),
      insertId: rows => rows.insertId,
    };
  }
  const db = new Client(toDriverConfig(config));
  await db.connect();
  return {
    query: async (sql, values = []) => (await db.query(sql, values)).rows,
    close: () => db.end(),
    insertId: rows => rows[0].id,
  };
}

async function seed(input = process.env) {
  assertDisposable(input);
  const config = resolveDatabaseConfig(input, { requireExplicitConnection: true });
  await checkSchemaReadiness(input);
  const db = await connect(config);
  const pg = config.dialect === 'postgres';
  const returning = pg ? ' RETURNING uniqueid AS id' : '';
  const params = count => Array.from({ length: count }, (_, index) => `$${index + 1}`).join(', ');
  try {
    await db.query('BEGIN');
    const existing = await db.query('SELECT uniqueid FROM users WHERE login IN ($1, $2, $3) OR level = 0', ['admin', 'ci-tenant-a', 'ci-tenant-b']);
    if (existing.length) throw new Error('Refusing to overwrite existing CI users or admin');
    const hash = await bcrypt.hash(input.CI_SEED_PASSWORD, 10);
    const now = new Date();
    const users = [];
    for (const [login, name, level] of [
      ['admin', 'CI platform admin', 0],
      ['ci-tenant-a', 'CI tenant A', 1],
      ['ci-tenant-b', 'CI tenant B', 1],
    ]) {
      const rows = await db.query(
        `INSERT INTO users (login, name, passwd, level, vpbx_user_uid, ${pg ? '"isActivated", "createdAt", "updatedAt"' : 'isActivated, createdAt, updatedAt'}) VALUES (${params(8)})${returning}`,
        [login, name, hash, level, 0, true, now, now],
      );
      users.push(db.insertId(rows));
    }
    for (const id of users.slice(1)) {
      await db.query('UPDATE users SET vpbx_user_uid = $1 WHERE uniqueid = $2', [id, id]);
    }
    for (const [index, name, slug] of [[1, 'CI Tenant A', 'ci-tenant-a'], [2, 'CI Tenant B', 'ci-tenant-b']]) {
      const id = users[index];
      await db.query(
        `INSERT INTO tenants (uid, name, slug, owner_user_id, vpbx_user_uid, status, created_by, created_at, updated_at) VALUES (${params(9)})`,
        [`00000000-0000-4000-8000-00000000000${index}`, name, slug, id, id, 'active', users[0], now, now],
      );
    }
    for (const id of users) {
      const rows = await db.query(`INSERT INTO roles (name, role, vpbx_user_uid, ${pg ? '"createdAt", "updatedAt"' : 'createdAt, updatedAt'}) VALUES (${params(5)})${pg ? ' RETURNING id' : ''}`, ['CI Administrator', '{}', id === users[0] ? 0 : id, now, now]);
      await db.query('UPDATE users SET role = $1 WHERE uniqueid = $2', [db.insertId(rows), id]);
    }
    for (const id of users.slice(1)) {
      await db.query(`INSERT INTO cc_ai_providers (name, kind, vendor, endpoint, auth_type, capabilities, pricing, enabled, vpbx_user_uid) VALUES (${params(9)})`,
        ['CI offline provider', 'local', 'ci', 'http://127.0.0.1:1', 'none', JSON.stringify(['llm']), JSON.stringify({}), false, id]);
    }
    await db.query('COMMIT');
    return { platformAdminId: users[0], tenantIds: users.slice(1) };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  seed().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { assertDisposable, seed };
