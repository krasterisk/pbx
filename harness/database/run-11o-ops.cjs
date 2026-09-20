'use strict';
// Disposable AI-11 11O ops drills. Named evidence wrapping I2 restore + I3 upgrade.
// No --rollback. No local Docker. No production DB. No live tenant debit.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { cleanInstall, CURRENT_SCHEMA } = require('./clean-install.cjs');
const {
  FIXTURE_PROVIDER_SECRET,
  JOB_ID,
  ASSET_ID,
  LICENSE_UID,
  generateDisposableKey,
  seedRestoreFixture,
  backupToPack,
  restoreFromPack,
  verifyRestoredCredential,
  main: backupMain,
} = require('./backup-restore.cjs');
const {
  n1Schema, applyN1, seedUpgradeFixture, upgrade, mayAdmitTraffic, JOB_ID: UPGRADE_JOB_ID, LICENSE_UID: UPGRADE_LICENSE,
} = require('./upgrade.cjs');
const {
  DRILL_STEPS, PROBE_CHECKLIST, refuseRollback, rehearseKeyRotation,
  probeAdmissionGate, probeDialectSwitch, publishedDrill,
} = require('./ops-drill.cjs');
const images = require('./images.json');

const args = process.argv.slice(2);
const selected = args.filter((value) => ['mysql', 'postgres'].includes(value));
if (args.some((value) => !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-11o-ops.cjs [mysql|postgres]');
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  test(`${dialect}: 11O ops drill backup→restore→upgrade→drain→admit (${images[dialect]})`, { timeout: 900000 }, async (t) => {
    const postgres = dialect === 'postgres';
    const password = crypto.randomBytes(24).toString('hex');
    const port = postgres ? 5432 : 3306;
    let container;
    try {
      container = await new GenericContainer(images[dialect])
        .withEnvironment(postgres
          ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_11o_admin' }
          : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_11o_admin' })
        .withExposedPorts(port)
        .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
        .withStartupTimeout(180000)
        .start();
    } catch {
      throw new Error('11O environment unavailable: Docker/image startup failed. Acceptance is NOT skipped or passed.');
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
      DB_NAME: 'krasterisk_11o_admin',
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
    const fresh = async (profile, extras = {}) => {
      const name = `krasterisk_ci_${dialect}${++sequence}`;
      await admin.query(postgres ? `CREATE DATABASE "${name}"` : `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
      return {
        ...environment,
        DB_NAME: name,
        DB_SCHEMA_PROFILE: profile,
        CI: 'true',
        CI_SEED_PASSWORD: 'disposable-11o-password',
        ...extras,
      };
    };
    const withConnection = async (input, fn) => {
      const config = resolveDatabaseConfig(input, { requireExplicitConnection: true });
      const adapter = await connectAdapter(config);
      try { return await fn(adapter); } finally { await adapter.close(); }
    };

    const results = [];

    await t.test('probe checklist: rollback refuse, dialect switch, drain gate, key rotation', async () => {
      assert.throws(() => refuseRollback(['--rollback']), /Automatic rollback/);
      await assert.rejects(backupMain(['--rollback']), /Automatic rollback/);
      const switchProbe = probeDialectSwitch(dialect);
      assert.equal(switchProbe.refused, true);
      const gate = probeAdmissionGate();
      assert.equal(gate.drainBlocked, true);
      assert.equal(gate.admitted, true);
      const rotation = rehearseKeyRotation();
      assert.equal(rotation.liveProductionRotated, false);
      assert.notEqual(rotation.previousKeyFingerprint, rotation.nextKeyFingerprint);
      results.push(
        { name: 'rollback_refused', pass: true },
        { name: 'dialect_switch_refused', pass: true },
        { name: 'drain_before_admit', pass: true },
        { name: 'key_rotation_rehearsal', pass: true, detail: rotation },
      );
      assert.deepEqual(DRILL_STEPS, ['backup', 'restore', 'upgrade', 'schema_readiness', 'worker_drain', 'admit_traffic']);
      assert.ok(PROBE_CHECKLIST.includes('missing_key_fail_closed'));
    });

    await t.test('named drill: I2 backup→restore then missing-key fail-closed', async () => {
      const sourceEnv = await fresh('analytics-api', { CC_AI_KEY_SECRET: generateDisposableKey() });
      const targetEnv = await fresh('analytics-api');
      const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-11o-pack-'));
      const sourceObjects = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-11o-obj-src-'));
      const targetObjects = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-11o-obj-dst-'));
      await cleanInstall(['--apply', '--seed-ci'], sourceEnv);
      const fixture = await withConnection(sourceEnv, async (db) => {
        const tenants = await db.query("SELECT uniqueid FROM users WHERE login = 'ci-tenant-a'");
        const tenantUid = Number(tenants[0].uniqueid);
        return seedRestoreFixture(db, {
          tenantUid,
          encryptionKey: sourceEnv.CC_AI_KEY_SECRET,
          objectsDir: sourceObjects,
        });
      });
      const manifest = await withConnection(sourceEnv, (db) => backupToPack(db, packDir, {
        env: sourceEnv,
        objectsDir: sourceObjects,
        encryptionKey: sourceEnv.CC_AI_KEY_SECRET,
      }));
      assert.equal(manifest.schemaVersion, CURRENT_SCHEMA);
      results.push({ name: 'backup', pass: true, detail: { schemaVersion: manifest.schemaVersion } });

      await cleanInstall(['--apply'], targetEnv);
      const restored = await withConnection(targetEnv, (db) => restoreFromPack(db, packDir, {
        env: targetEnv,
        objectsDir: targetObjects,
        requireKey: true,
      }));
      assert.equal(restored.invariants.schemaVersion, CURRENT_SCHEMA);
      assert.equal(restored.invariants.ledgerSum, '8');
      assert.deepEqual(restored.invariants.jobIds, [JOB_ID]);
      assert.deepEqual(restored.invariants.assetIds, [ASSET_ID]);
      assert.ok(restored.invariants.licenseBindings.some((row) => row.includes(LICENSE_UID)));
      const plain = await withConnection(targetEnv, (db) => verifyRestoredCredential(
        db, fixture.tenantUid, { CC_AI_KEY_SECRET: restored.secret },
      ));
      assert.equal(plain, FIXTURE_PROVIDER_SECRET);
      results.push({ name: 'restore', pass: true, detail: { ledgerSum: restored.invariants.ledgerSum } });

      fs.rmSync(path.join(packDir, 'encryption.key'));
      const nokeyEnv = await fresh('analytics-api');
      await cleanInstall(['--apply'], nokeyEnv);
      await withConnection(nokeyEnv, async (db) => {
        await assert.rejects(
          restoreFromPack(db, packDir, { env: nokeyEnv, requireKey: true }),
          /AI_PROVIDER_KEY_UNAVAILABLE/,
        );
      });
      results.push({ name: 'missing_key_fail_closed', pass: true });
    });

    await t.test('named drill: I3 N-1→upgrade→schema ready→drain→admit (analytics-api)', async () => {
      const input = await fresh('analytics-api');
      const n1 = await applyN1(input);
      assert.equal(n1.schemaVersion, n1Schema(dialect, 'analytics-api'));
      await withConnection(input, (db) => seedUpgradeFixture(db, 1));
      const first = await upgrade(['--upgrade'], input);
      assert.equal(first.readiness.schemaVersion, CURRENT_SCHEMA);
      assert.deepEqual(first.applied.newlyApplied, [CURRENT_SCHEMA]);
      await withConnection(input, async (db) => {
        const jobs = await db.query(`SELECT id FROM ai_jobs WHERE id = '${UPGRADE_JOB_ID}'`);
        assert.equal(jobs.length, 1);
        const licenses = await db.query(`SELECT document_uid FROM ai_local_license_bindings WHERE document_uid = '${UPGRADE_LICENSE}'`);
        assert.equal(licenses.length, 1);
      });
      const replay = await upgrade(['--upgrade'], input);
      assert.deepEqual(replay.applied.newlyApplied, []);
      results.push({ name: 'upgrade', pass: true, detail: { schemaVersion: CURRENT_SCHEMA } });
      results.push({ name: 'schema_readiness', pass: true });

      assert.throws(() => mayAdmitTraffic({
        schemaReady: true, drained: false, workersReady: true,
      }), /drain before admitting/);
      results.push({ name: 'worker_drain', pass: true });
      assert.deepEqual(mayAdmitTraffic({
        schemaReady: true, drained: true, workersReady: true,
      }), { admitted: true });
      results.push({ name: 'admit_traffic', pass: true });
    });

    const report = publishedDrill(results);
    assert.equal(report.productSlaClaimed, false);
    assert.equal(report.constraints.noAutomaticRollback, true);
    const outDir = process.env.AI11_11O_OUT
      || path.join(__dirname, '../../.planning/initiatives/ai-products/evidence/11o');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `drill-${dialect}.json`);
    fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
    t.diagnostic(`drill=${outFile}`);
  });
}
