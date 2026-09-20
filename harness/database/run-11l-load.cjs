'use strict';
// Disposable AI-11 11L load profile. I1 analytics-api + admission ladder 1→5→20.
// Media vs batch fairness; quota fail-closed. No local Docker. No cloud_wallet debit.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { cleanInstall, CURRENT_SCHEMA } = require('./clean-install.cjs');
const {
  LADDER, measureAdmissionLadder, mediaNotStarvedByBatch, quotaFailClosed, publishedProfile,
} = require('./load-profile.cjs');
const images = require('./images.json');

const args = process.argv.slice(2);
const selected = args.filter((value) => ['mysql', 'postgres'].includes(value));
if (args.some((value) => !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-11l-load.cjs [mysql|postgres]');
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  test(`${dialect}: 11L load ladder + fairness (${images[dialect]})`, { timeout: 720000 }, async (t) => {
    const postgres = dialect === 'postgres';
    const password = crypto.randomBytes(24).toString('hex');
    const dbPort = postgres ? 5432 : 3306;
    let container;
    try {
      container = await new GenericContainer(images[dialect])
        .withEnvironment(postgres
          ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_11l_admin' }
          : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_11l_admin' })
        .withExposedPorts(dbPort)
        .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
        .withStartupTimeout(180000)
        .start();
    } catch {
      throw new Error('11L environment unavailable: Docker/image startup failed. Acceptance is NOT skipped or passed.');
    }
    let admin;
    t.after(async () => {
      try { if (admin) await admin.close(); } catch { /* closed */ }
      await container.stop();
    });

    const environment = {
      DB_DIALECT: dialect,
      DB_HOST: container.getHost(),
      DB_PORT: String(container.getMappedPort(dbPort)),
      DB_USER: postgres ? 'postgres' : 'root',
      DB_PASSWORD: password,
      DB_NAME: 'krasterisk_11l_admin',
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

    await t.test('I1 analytics-api then admission ladder 1→5→20 without product SLA', async () => {
      const dbName = `krasterisk_ci_${dialect}11l`;
      await admin.query(postgres ? `CREATE DATABASE "${dbName}"` : `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4`);
      await admin.close();
      admin = null;
      const fixturePassword = crypto.randomBytes(24).toString('hex');
      const appEnv = {
        ...environment,
        DB_NAME: dbName,
        DB_SCHEMA_PROFILE: 'analytics-api',
        KRASTERISK_BINARY: 'analytics-api',
        CI: 'true',
        CI_SEED_PASSWORD: fixturePassword,
      };
      const installed = await cleanInstall(['--apply', '--seed-ci'], appEnv);
      assert.equal(installed.readiness.schemaVersion, CURRENT_SCHEMA);

      const inspect = await connectAdapter(resolveDatabaseConfig(appEnv, { requireExplicitConnection: true }));
      try {
        const jobs = await inspect.query(postgres
          ? "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ai_jobs'"
          : "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='ai_jobs'");
        assert.equal(jobs.length, 1, 'analytics-api must install ai_jobs for admission');
        const cdr = await inspect.query(postgres
          ? "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cdr'"
          : "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='cdr'");
        assert.equal(cdr.length, 0, 'analytics-only must not install cdr');
      } finally {
        await inspect.close();
      }

      const ladder = measureAdmissionLadder();
      assert.deepEqual(ladder.map((row) => row.concurrency), [...LADDER]);
      for (const row of ladder) {
        assert.equal(row.errors, 0, `ladder ${row.concurrency} must admit without fairness reject under default caps`);
        assert.equal(row.admitted, row.concurrency);
        t.diagnostic(JSON.stringify({
          dialect, concurrency: row.concurrency, p50Ms: row.p50Ms, p95Ms: row.p95Ms, durationMs: row.durationMs,
        }));
      }

      const media = mediaNotStarvedByBatch();
      assert.equal(media.batchBlocked, true);
      assert.equal(media.mediaAdmitted, true);

      const quota = quotaFailClosed();
      assert.equal(quota.rejected, true);
      assert.equal(quota.code, 'fairness_exhausted');

      const profile = publishedProfile(ladder, { mediaVsBatch: media, quota });
      assert.equal(profile.productSlaClaimed, false);
      assert.equal(profile.constraints.noLiveTenantDebit, true);
      assert.equal(profile.constraints.productRuntime, 'not-installed');

      const outDir = process.env.AI11_11L_OUT
        || path.join(__dirname, '../../.planning/initiatives/ai-products/evidence/11l');
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, `profile-${dialect}.json`);
      fs.writeFileSync(outFile, `${JSON.stringify(profile, null, 2)}\n`);
      t.diagnostic(`profile=${outFile}`);
    });
  });
}
