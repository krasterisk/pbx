/** Disposable versioned MySQL fixture for autodial backend acceptance. */
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const mysql = require('mysql2/promise');

const NAME = 'krasterisk_ci_ac20260918z';
const action = process.argv[2];
if (!['create', 'drop'].includes(action) || process.env.AC_LIVE_GATE_ALLOWED !== '1') {
  throw new Error('Set AC_LIVE_GATE_ALLOWED=1 and use create or drop');
}
for (const line of fs.readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}
if (process.env.DB_DIALECT && process.env.DB_DIALECT !== 'mysql') throw new Error('MySQL fixture only');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectTimeout: 5000,
  });
  try {
    const [found] = await connection.query('SHOW DATABASES LIKE ?', [NAME]);
    if (action === 'create') {
      if (found.length) throw new Error(`Refusing to replace existing database ${NAME}`);
      await connection.query(`CREATE DATABASE \`${NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      process.env.DB_NAME = NAME;
      process.env.CI = 'true';
      process.env.CI_SEED_PASSWORD = randomBytes(24).toString('base64url');
      const { main: migrate } = require('../../../packages/backend/database/run-migrations.cjs');
      const { seed } = require('../../../packages/backend/database/seed-ci.cjs');
      const migration = await migrate([], process.env);
      const fixture = await seed(process.env);
      await connection.query(`CREATE TABLE \`${NAME}\`.autodial_harness_marker (id INT PRIMARY KEY, token VARCHAR(64) NOT NULL)`);
      await connection.query(`INSERT INTO \`${NAME}\`.autodial_harness_marker (id, token) VALUES (1, 'codex-autodial-20260918')`);
      console.log(JSON.stringify({ action, name: NAME, version: migration.schemaVersion, tenantIds: fixture.tenantIds }));
    } else {
      if (!found.length) { console.log(JSON.stringify({ action, name: NAME, absent: true })); return; }
      const [marker] = await connection.query(`SELECT token FROM \`${NAME}\`.autodial_harness_marker WHERE id = 1`);
      if (marker.length !== 1 || marker[0].token !== 'codex-autodial-20260918') {
        throw new Error(`Refusing to drop unmarked database ${NAME}`);
      }
      await connection.query(`DROP DATABASE \`${NAME}\``);
      console.log(JSON.stringify({ action, name: NAME, removed: true }));
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
