'use strict';
// Disposable I3 matrix. Fresh containers and generated credentials only. Never reads ambient DB_*.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter, STATE } = require('../../packages/backend/database/migration-adapter.cjs');
const { CURRENT_SCHEMA } = require('./clean-install.cjs');
const {
  SKU_TABLES, JOB_ID, LICENSE_UID, n1Schema, applyN1, seedUpgradeFixture, upgrade, mayAdmitTraffic,
} = require('./upgrade.cjs');
const images = require('./images.json');

const args = process.argv.slice(2);
const selected = args.filter((value) => ['mysql', 'postgres'].includes(value));
if (args.some((value) => !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-i3-upgrade.cjs [mysql|postgres]');
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  test(`${dialect}: I3 N-1 upgrade matrix (${images[dialect]})`, { timeout: 720000 }, async (t) => {
    const postgres = dialect === 'postgres';
    const password = crypto.randomBytes(24).toString('hex');
    const port = postgres ? 5432 : 3306;
    let container;
    try {
      container = await new GenericContainer(images[dialect])
        .withEnvironment(postgres
          ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_i3_admin' }
          : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_i3_admin' })
        .withExposedPorts(port)
        .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
        .withStartupTimeout(180000)
        .start();
    } catch {
      throw new Error(`I3 upgrade environment unavailable: Docker/image startup failed. Acceptance is NOT skipped or passed.`);
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
      DB_NAME: 'krasterisk_i3_admin',
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
    const fresh = async (profile) => {
      const name = `krasterisk_ci_${dialect}${++sequence}`;
      await admin.query(postgres ? `CREATE DATABASE "${name}"` : `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
      return {
        ...environment,
        DB_NAME: name,
        DB_SCHEMA_PROFILE: profile,
        CI: 'true',
        CI_SEED_PASSWORD: 'disposable-i3-password',
      };
    };
    const withConnection = async (input, fn) => {
      const config = resolveDatabaseConfig(input, { requireExplicitConnection: true });
      const adapter = await connectAdapter(config);
      try { return await fn(adapter); } finally { await adapter.close(); }
    };

    for (const profile of ['analytics-api', 'full-pbx']) {
      await t.test(`${profile} N-1 ${n1Schema(dialect, profile)} → ${CURRENT_SCHEMA}, fixture survives, replay no-op`, async () => {
        const input = await fresh(profile);
        const n1 = await applyN1(input);
        assert.equal(n1.schemaVersion, n1Schema(dialect, profile));
        await withConnection(input, async (db) => {
          const tables = await db.tables();
          for (const table of SKU_TABLES) assert.ok(!tables.includes(table), `${table} leaked into N-1`);
          if (profile === 'full-pbx') assert.ok(tables.includes('queue_log'));
          await seedUpgradeFixture(db, 1);
        });
        const first = await upgrade(['--upgrade'], input);
        assert.equal(first.readiness.schemaVersion, CURRENT_SCHEMA);
        assert.deepEqual(first.applied.newlyApplied, [CURRENT_SCHEMA]);
        await withConnection(input, async (db) => {
          const tables = await db.tables();
          for (const table of SKU_TABLES) assert.ok(tables.includes(table), `missing ${table} after upgrade`);
          const jobs = await db.query(`SELECT id FROM ai_jobs WHERE id = '${JOB_ID}'`);
          assert.equal(jobs.length, 1);
          const licenses = await db.query(`SELECT document_uid FROM ai_local_license_bindings WHERE document_uid = '${LICENSE_UID}'`);
          assert.equal(licenses.length, 1);
        });
        const replay = await upgrade(['--upgrade'], input);
        assert.deepEqual(replay.applied.newlyApplied, []);
        assert.throws(() => mayAdmitTraffic({
          schemaReady: true, drained: false, workersReady: true,
        }), /drain before admitting/);
        assert.deepEqual(mayAdmitTraffic({
          schemaReady: true, drained: true, workersReady: true,
        }), { admitted: true });
      });
    }

    await t.test('dirty journal refuses upgrade without silent repair', async () => {
      const input = await fresh('analytics-api');
      await applyN1(input);
      await withConnection(input, async (db) => {
        await db.query(`UPDATE ${STATE} SET dirty_name='${CURRENT_SCHEMA}', dirty_checksum='${'ab'.repeat(32)}'`);
      });
      await assert.rejects(upgrade(['--upgrade'], input), /Interrupted\/failed/);
      const status = await upgrade(['--status'], input);
      assert.equal(status.ok, false);
      assert.equal(status.applied.dirty.name, CURRENT_SCHEMA);
    });
  });
}
