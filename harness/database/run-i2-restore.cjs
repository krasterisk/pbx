'use strict';
// Disposable I2 matrix. Fresh containers and generated credentials only. Never reads ambient DB_*.
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
  DIALECT_SWITCH_MESSAGE,
  FIXTURE_PROVIDER_SECRET,
  JOB_ID,
  ASSET_ID,
  LICENSE_UID,
  generateDisposableKey,
  sqlParam,
  seedRestoreFixture,
  backupToPack,
  restoreFromPack,
  verifyRestoredCredential,
  assertSameEngine,
  readRestoredCredential,
} = require('./backup-restore.cjs');
const images = require('./images.json');

const args = process.argv.slice(2);
const selected = args.filter((value) => ['mysql', 'postgres'].includes(value));
if (args.some((value) => !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-i2-restore.cjs [mysql|postgres]');
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  test(`${dialect}: I2 backup/restore matrix (${images[dialect]})`, { timeout: 720000 }, async (t) => {
    const postgres = dialect === 'postgres';
    const password = crypto.randomBytes(24).toString('hex');
    const port = postgres ? 5432 : 3306;
    let container;
    try {
      container = await new GenericContainer(images[dialect])
        .withEnvironment(postgres
          ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_i2_admin' }
          : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_i2_admin' })
        .withExposedPorts(port)
        .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
        .withStartupTimeout(180000)
        .start();
    } catch {
      throw new Error(`I2 restore environment unavailable: Docker/image startup failed. Acceptance is NOT skipped or passed.`);
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
      DB_NAME: 'krasterisk_i2_admin',
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
    const freshCi = async (name) => {
      const dbName = `krasterisk_ci_${dialect}${++sequence}`;
      await admin.query(postgres ? `CREATE DATABASE "${dbName}"` : `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4`);
      return {
        ...environment,
        DB_NAME: dbName,
        DB_SCHEMA_PROFILE: 'analytics-api',
        CI: 'true',
        CI_SEED_PASSWORD: 'disposable-i2-password',
        CC_AI_KEY_SECRET: generateDisposableKey(),
      };
    };
    const withConnection = async (input, fn) => {
      const config = resolveDatabaseConfig(input, { requireExplicitConnection: true });
      const adapter = await connectAdapter(config);
      try { return await fn(adapter); } finally { await adapter.close(); }
    };

    await t.test('backup then restore keeps schema, ledger, jobs, assets, licenses, objects', async () => {
      const sourceEnv = await freshCi('source');
      const targetEnv = await freshCi('target');
      const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-i2-pack-'));
      const sourceObjects = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-i2-obj-src-'));
      const targetObjects = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-i2-obj-dst-'));
      const first = await cleanInstall(['--apply', '--seed-ci'], sourceEnv);
      assert.equal(first.readiness.schemaVersion, CURRENT_SCHEMA);
      const fixture = await withConnection(sourceEnv, async (db) => {
        const tenants = await db.query("SELECT uniqueid FROM users WHERE login = 'ci-tenant-a'");
        assert.equal(tenants.length, 1);
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
      assert.equal(manifest.invariants.ledgerSum, '8');
      assert.deepEqual(manifest.invariants.jobIds, [JOB_ID]);
      assert.deepEqual(manifest.invariants.assetIds, [ASSET_ID]);
      assert.ok(manifest.invariants.licenseBindings.some((row) => row.includes(LICENSE_UID)));
      const targetApply = await cleanInstall(['--apply'], targetEnv);
      assert.equal(targetApply.readiness.schemaVersion, CURRENT_SCHEMA);
      const restored = await withConnection(targetEnv, (db) => restoreFromPack(db, packDir, {
        env: targetEnv,
        objectsDir: targetObjects,
        requireKey: true,
      }));
      assert.equal(restored.invariants.schemaVersion, CURRENT_SCHEMA);
      assert.equal(restored.invariants.ledgerSum, '8');
      const plain = await withConnection(targetEnv, (db) => verifyRestoredCredential(
        db, fixture.tenantUid, { CC_AI_KEY_SECRET: restored.secret },
      ));
      assert.equal(plain, FIXTURE_PROVIDER_SECRET);
      assert.equal(
        fs.readFileSync(path.join(targetObjects, fixture.storageKey), 'utf8'),
        'I2-RESTORE-FIXTURE',
      );
    });

    await t.test('restore without key leaves ciphertext unread and fails closed', async () => {
      const sourceEnv = await freshCi('nokey-src');
      const targetEnv = await freshCi('nokey-dst');
      const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-i2-nokey-'));
      const sourceObjects = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-i2-nokey-obj-'));
      await cleanInstall(['--apply', '--seed-ci'], sourceEnv);
      const tenantUid = await withConnection(sourceEnv, async (db) => {
        const tenants = await db.query("SELECT uniqueid FROM users WHERE login = 'ci-tenant-a'");
        const uid = Number(tenants[0].uniqueid);
        await seedRestoreFixture(db, {
          tenantUid: uid,
          encryptionKey: sourceEnv.CC_AI_KEY_SECRET,
          objectsDir: sourceObjects,
        });
        return uid;
      });
      await withConnection(sourceEnv, (db) => backupToPack(db, packDir, {
        env: sourceEnv,
        objectsDir: sourceObjects,
        encryptionKey: sourceEnv.CC_AI_KEY_SECRET,
      }));
      fs.rmSync(path.join(packDir, 'encryption.key'));
      await cleanInstall(['--apply'], targetEnv);
      await withConnection(targetEnv, async (db) => {
        await assert.rejects(
          restoreFromPack(db, packDir, { env: targetEnv, requireKey: true }),
          /AI_PROVIDER_KEY_UNAVAILABLE/,
        );
        const restored = await restoreFromPack(db, packDir, {
          env: targetEnv,
          requireKey: false,
        });
        assert.equal(restored.invariants.ledgerSum, '8');
        await assert.rejects(
          verifyRestoredCredential(db, tenantUid, {}),
          /AI_PROVIDER_KEY_UNAVAILABLE/,
        );
        const rows = await db.query(
          `SELECT encrypted_api_key FROM cc_ai_providers WHERE vpbx_user_uid = ${sqlParam(db, 1)} LIMIT 1`,
          [tenantUid],
        );
        const blob = rows[0].encrypted_api_key;
        assert.match(String(blob), /^v2:/);
        assert.throws(() => readRestoredCredential(blob, {}), /AI_PROVIDER_KEY_UNAVAILABLE/);
      });
    });

    await t.test('cross-engine restore is refused', () => {
      assert.throws(
        () => assertSameEngine({ dialect, profile: 'analytics-api' }, {
          DB_DIALECT: dialect === 'mysql' ? 'postgres' : 'mysql',
          DB_SCHEMA_PROFILE: 'analytics-api',
        }),
        new RegExp(DIALECT_SWITCH_MESSAGE.replace(/[()]/g, '\\$&')),
      );
    });
  });
}
