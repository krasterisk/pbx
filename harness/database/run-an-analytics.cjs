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
  throw new Error('Usage: node harness/database/run-an-analytics.cjs [mysql|postgres]');
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  const postgres = dialect === 'postgres';
  test(`${dialect}: AN1-AN4 analytics SQL contracts (${images[dialect]})`, { timeout: 300000 }, async t => {
    const password = crypto.randomBytes(24).toString('hex');
    const dbPort = postgres ? 5432 : 3306;
    const db = await new GenericContainer(images[dialect])
      .withEnvironment(postgres
        ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_an' }
        : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_an' })
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
      DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password, DB_NAME: 'krasterisk_an',
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
    await runMigrations({
      config, migrations: loadMigrations(dialect, 'analytics-api'), profile: 'analytics-api',
    });
    const now = 'CURRENT_TIMESTAMP';
    const hash = `'${'ab'.repeat(32)}'`;
    const project = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1001';
    const version = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1002';
    const asset = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1003';
    const rec = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1004';
    const job = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1005';
    const run = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1006';

    await t.test('project versions and business-key uniqueness', async () => {
      await adapter.query(`INSERT INTO sa_projects
        (id, vpbx_user_uid, name, status, draft_revision, draft_config, created_by, created_at, updated_at)
        VALUES ('${project}', 8, 'Pilot', 'active', 1, '{}', 7, ${now}, ${now})`);
      await adapter.query(`INSERT INTO sa_project_versions
        (id, vpbx_user_uid, project_id, version_no, config_digest, config, stt_revision_id, llm_revision_id, created_by, created_at)
        VALUES ('${version}', 8, '${project}', 1, ${hash}, '{}', 'stt', 'llm', 7, ${now})`);
      await adapter.query(`INSERT INTO ai_media_assets
        (id, vpbx_user_uid, source_kind, storage_key, state, sha256, bytes, media_metadata, version, created_at, updated_at)
        VALUES ('${asset}', 8, 'upload', 'krs:v1:local:8:${asset}', 'ready', ${hash}, 12, '{}', 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO sa_recordings
        (id, vpbx_user_uid, project_id, integration_principal_id, external_call_id, source_part, business_key_hash, asset_id, metadata, content_digest, occurred_at, created_at)
        VALUES ('${rec}', 8, '${project}', 'prin-1', 'call-1', 'main', ${hash}, '${asset}', '{}', ${hash}, ${now}, ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO sa_recordings
        (id, vpbx_user_uid, project_id, integration_principal_id, external_call_id, source_part, business_key_hash, asset_id, metadata, content_digest, occurred_at, created_at)
        VALUES ('other', 8, '${project}', 'prin-1', 'call-1', 'main', ${hash}, '${asset}', '{}', ${hash}, ${now}, ${now})`));
      await adapter.query(`INSERT INTO ai_jobs
        (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
        VALUES ('${job}', 8, 'speech_analytics', 'analyze', 'project', '${project}', 'queued', 0, ${now}, 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO sa_analysis_runs
        (id, vpbx_user_uid, recording_id, project_version_id, job_id, state, created_at, updated_at)
        VALUES ('${run}', 8, '${rec}', '${version}', '${job}', 'queued', ${now}, ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO sa_analysis_runs
        (id, vpbx_user_uid, recording_id, project_version_id, job_id, state, created_at, updated_at)
        VALUES ('run-2', 8, '${rec}', '${version}', '${job}', 'queued', ${now}, ${now})`));
    });

    await t.test('webhook https check and delivery uniqueness', async () => {
      await adapter.query(`INSERT INTO ai_webhook_endpoints
        (id, vpbx_user_uid, principal_id, project_id, destination_url, secret_ref, key_version, status, revision, created_at, updated_at)
        VALUES ('wh-1', 8, 'user:7', '${project}', 'https://hooks.example.test/sa', 'secret:1', 1, 'active', 1, ${now}, ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_webhook_endpoints
        (id, vpbx_user_uid, principal_id, project_id, destination_url, secret_ref, key_version, status, revision, created_at, updated_at)
        VALUES ('wh-2', 8, 'user:7', '${project}', 'http://hooks.example.test/sa', 'secret:1', 1, 'active', 1, ${now}, ${now})`));
      await adapter.query(`INSERT INTO ai_webhook_deliveries
        (id, vpbx_user_uid, event_id, endpoint_id, endpoint_revision, payload_digest, state, attempt, created_at, updated_at)
        VALUES ('del-1', 8, 'evt-1', 'wh-1', 1, ${hash}, 'pending', 0, ${now}, ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_webhook_deliveries
        (id, vpbx_user_uid, event_id, endpoint_id, endpoint_revision, payload_digest, state, attempt, created_at, updated_at)
        VALUES ('del-2', 8, 'evt-1', 'wh-1', 1, ${hash}, 'pending', 0, ${now}, ${now})`));
    });
  });
}
