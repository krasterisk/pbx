'use strict';
// Disposable I1 matrix. Fresh containers and generated credentials only. Never reads ambient DB_*.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter, STATE } = require('../../packages/backend/database/migration-adapter.cjs');
const { cleanInstall, CURRENT_SCHEMA, STANDALONE_EXCLUDED } = require('./clean-install.cjs');
const images = require('./images.json');

const args = process.argv.slice(2);
const selected = args.filter((value) => ['mysql', 'postgres'].includes(value));
if (args.some((value) => !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-i1-install.cjs [mysql|postgres]');
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  test(`${dialect}: I1 clean install matrix (${images[dialect]})`, { timeout: 720000 }, async (t) => {
    const postgres = dialect === 'postgres';
    const password = crypto.randomBytes(24).toString('hex');
    const port = postgres ? 5432 : 3306;
    let container;
    try {
      container = await new GenericContainer(images[dialect])
        .withEnvironment(postgres
          ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_i1_admin' }
          : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_i1_admin' })
        .withExposedPorts(port)
        .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
        .withStartupTimeout(180000)
        .start();
    } catch {
      throw new Error(`I1 install environment unavailable: Docker/image startup failed. Acceptance is NOT skipped or passed.`);
    }
    let admin;
    t.after(async () => {
      try { if (admin) await admin.close(); } finally { await container.stop(); }
    });
    const environment = {
      DB_DIALECT: dialect,
      DB_HOST: container.getHost(),
      DB_PORT: String(container.getMappedPort(port)),
      DB_USER: postgres ? 'postgres' : 'root',
      DB_PASSWORD: password,
      DB_NAME: 'krasterisk_i1_admin',
      NODE_ENV: 'development',
      AI_WORKERS_CONFIGURED: '1',
    };
    const adminConfig = resolveDatabaseConfig(environment, { requireExplicitConnection: true });
    const readyDeadline = performance.now() + 60000;
    for (;;) {
      try {
        admin = await connectAdapter(adminConfig);
        break;
      } catch (error) {
        if (performance.now() >= readyDeadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    const versions = await admin.query('SELECT version() AS version');
    t.diagnostic(JSON.stringify({ image: images[dialect], server: versions[0].version }));
    let sequence = 0;
    const freshCi = async (profile) => {
      const name = `krasterisk_ci_${dialect}${++sequence}`;
      await admin.query(postgres ? `CREATE DATABASE "${name}"` : `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
      return {
        ...environment,
        DB_NAME: name,
        DB_SCHEMA_PROFILE: profile,
        CI: 'true',
        CI_SEED_PASSWORD: 'disposable-i1-password',
      };
    };
    const withConnection = async (input, fn) => {
      const config = resolveDatabaseConfig(input, { requireExplicitConnection: true });
      const adapter = await connectAdapter(config);
      try { return await fn(adapter); } finally { await adapter.close(); }
    };

    for (const profile of ['full-pbx', 'analytics-api', 'robot-api']) {
      await t.test(`${profile} empty install reaches ${CURRENT_SCHEMA}, seeds 0/A/B, refuses overwrite and wrong profile`, async () => {
        const input = await freshCi(profile);
        const first = await cleanInstall(['--apply', '--seed-ci'], input);
        assert.equal(first.readiness.schemaVersion, CURRENT_SCHEMA);
        assert.equal(first.plan.includesPbxOdbc, profile === 'full-pbx');
        assert.equal(first.seed.tenantIds.length, 2);
        await withConnection(input, async (db) => {
          const tables = await db.tables();
          if (profile === 'full-pbx') {
            assert.ok(tables.includes('queue_log'), 'full-pbx missing 0019 queue_log');
            assert.ok(tables.includes('cdr'));
          } else {
            for (const excluded of STANDALONE_EXCLUDED) {
              assert.ok(!tables.includes(excluded), `${excluded} leaked into ${profile}`);
            }
          }
          const users = await db.query('SELECT uniqueid, vpbx_user_uid FROM users ORDER BY uniqueid');
          assert.equal(users.length, 3);
          assert.equal(Number(users[0].vpbx_user_uid), 0);
        });
        await assert.rejects(cleanInstall(['--apply', '--seed-ci'], input), /Refusing to overwrite/);
        const replay = await cleanInstall(['--apply'], input);
        assert.deepEqual(replay.applied.newlyApplied, []);
        const other = profile === 'full-pbx' ? 'analytics-api' : 'full-pbx';
        await assert.rejects(cleanInstall(['--status'], { ...input, DB_SCHEMA_PROFILE: other }), /profile mismatch/);
      });
    }

    await t.test('dirty journal refuses apply', async () => {
      const input = await freshCi('analytics-api');
      await cleanInstall(['--apply'], input);
      await withConnection(input, async (db) => {
        await db.query(`UPDATE ${STATE} SET dirty_name='0020-ai-sku-catalog.sql', dirty_checksum='${'ab'.repeat(32)}'`);
      });
      await assert.rejects(cleanInstall(['--apply'], input), /Interrupted\/failed/);
      const status = await cleanInstall(['--status'], input);
      assert.equal(status.ok, false);
      assert.equal(status.applied.dirty.name, '0020-ai-sku-catalog.sql');
    });
  });
}
