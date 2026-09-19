'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { runMigrations, loadMigrations } = require('../../packages/backend/database/migration-runner.cjs');
const images = require('./images.json');

const selected = process.argv.slice(2).filter(value => ['mysql', 'postgres'].includes(value));
if (process.argv.slice(2).some(value => !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-cap1-capture.cjs [mysql|postgres]');
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  const postgres = dialect === 'postgres';
  test(`${dialect}: CAP1 capture uniqueness and tenant isolation (${images[dialect]})`, { timeout: 300000 }, async t => {
    const password = crypto.randomBytes(24).toString('hex');
    const dbPort = postgres ? 5432 : 3306;
    const db = await new GenericContainer(images[dialect])
      .withEnvironment(postgres
        ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_cap1' }
        : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_cap1' })
      .withExposedPorts(dbPort)
      .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
      .withStartupTimeout(180000)
      .start();
    let adapter;
    t.after(async () => {
      try { if (adapter) await adapter.close(); } finally { await db.stop(); }
    });
    const environment = {
      DB_DIALECT: dialect, DB_HOST: db.getHost(), DB_PORT: String(db.getMappedPort(dbPort)),
      DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password, DB_NAME: 'krasterisk_cap1',
    };
    const config = resolveDatabaseConfig(environment, { requireExplicitConnection: true });
    const deadline = performance.now() + 60000;
    for (;;) {
      try { adapter = await connectAdapter(config); break; }
      catch (error) {
        if (performance.now() >= deadline) throw error;
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
    await runMigrations({ config, migrations: loadMigrations(dialect) });
    const now = 'CURRENT_TIMESTAMP';
    const hash = `'${'ab'.repeat(32)}'`;
    const bindA = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001';
    const rec = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002';
    const asset = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0003';

    await t.test('node+recording uniqueness and foreign asset FK', async () => {
      await adapter.query(`INSERT INTO ai_capture_node_bindings
        (id, node_id, vpbx_user_uid, revision, status, identity_digest, expires_at, config_digest, created_at)
        VALUES ('${bindA}', 'node-a', 8, 1, 'active', ${hash}, '2027-01-01 00:00:00.000', ${hash}, ${now})`);
      await adapter.query(`INSERT INTO ai_media_assets
        (id, vpbx_user_uid, source_kind, storage_key, state, sha256, bytes, media_metadata, version, created_at, updated_at)
        VALUES ('${asset}', 8, 'upload', 'krs:v1:local:8:${asset}', 'ready', ${hash}, 12, '{}', 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_capture_intents
        (id, vpbx_user_uid, node_id, recording_uid, origin_kind, origin_id, recorder_id, binding_id, binding_revision, state, policy_snapshot, created_at)
        VALUES ('intent-a', 8, 'node-a', '${rec}', 'robot_session', 's1', 'rec-1', '${bindA}', 1, 'open', '{}', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_capture_intents
        (id, vpbx_user_uid, node_id, recording_uid, origin_kind, origin_id, recorder_id, binding_id, binding_revision, state, policy_snapshot, created_at)
        VALUES ('intent-b', 9, 'node-a', '${rec}', 'robot_session', 's1', 'rec-1', '${bindA}', 1, 'open', '{}', ${now})`));
      await adapter.query(`INSERT INTO ai_capture_receipts
        (id, vpbx_user_uid, node_id, recording_uid, manifest_revision, digest, asset_id, status, acked_at)
        VALUES ('receipt-a', 8, 'node-a', '${rec}', 1, ${hash}, '${asset}', 'acked', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_capture_receipts
        (id, vpbx_user_uid, node_id, recording_uid, manifest_revision, digest, asset_id, status, acked_at)
        VALUES ('receipt-b', 9, 'node-a', '${rec}', 1, ${hash}, '${asset}', 'acked', ${now})`));
    });
  });
}
