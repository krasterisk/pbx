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
  throw new Error('Usage: node harness/database/run-d4-usage.cjs [mysql|postgres]');
}

function casWon(result) {
  return (Array.isArray(result) ? result.length : Number(result.affectedRows)) === 1;
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  const postgres = dialect === 'postgres';
  test(`${dialect}: D4 usage/quota/shadow SQL contracts (${images[dialect]})`, { timeout: 300000 }, async t => {
    const password = crypto.randomBytes(24).toString('hex');
    const dbPort = postgres ? 5432 : 3306;
    const db = await new GenericContainer(images[dialect])
      .withEnvironment(postgres
        ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_d4' }
        : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_d4' })
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
      DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password, DB_NAME: 'krasterisk_d4',
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
    const jobId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const opId = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';

    await adapter.query(`INSERT INTO ai_jobs
      (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
      VALUES ('${jobId}', 8, 'speech_analytics', 'analyze', 'asset', 'asset-d4', 'queued', 0, ${now}, 1, ${now}, ${now})`);
    await adapter.query(`INSERT INTO ai_job_stages
      (id, vpbx_user_uid, job_id, stage_key, state, attempt_count, fence, version, created_at, updated_at)
      VALUES ('stage-d4', 8, '${jobId}', 'run', 'pending', 0, 0, 1, ${now}, ${now})`);
    await adapter.query(`INSERT INTO ai_provider_revisions
      (id, vpbx_user_uid, provider_uid, revision, configuration, capability_digest, credential_ref, key_version, created_at)
      VALUES ('rev-d4', 8, 'test', 1, '{}', ${hash}, 'cred', 1, ${now})`);
    await adapter.query(`INSERT INTO ai_provider_operations
      (id, vpbx_user_uid, stage_id, ordinal, provider_revision_id, state, idempotency_token, request_hash, version, created_at, updated_at)
      VALUES ('${opId}', 8, 'stage-d4', 1, 'rev-d4', 'prepared', ${hash}, ${hash}, 1, ${now}, ${now})`);

    await t.test('quota CAS at the limit has one winner; metrics stay separate', async () => {
      await adapter.query(`INSERT INTO ai_quota_counters
        (vpbx_user_uid, product, metric, period_start, limit_units, used_units, reserved_units, revision, updated_at)
        VALUES (8, 'speech_analytics', 'audio_ms', '2026-09-01 00:00:00.000', 10, 0, 0, 1, ${now})`);
      const sql = postgres
        ? `UPDATE ai_quota_counters SET reserved_units=6, revision=2 WHERE vpbx_user_uid=8 AND metric='audio_ms' AND revision=1 RETURNING revision`
        : `UPDATE ai_quota_counters SET reserved_units=6, revision=2 WHERE vpbx_user_uid=8 AND metric='audio_ms' AND revision=1`;
      const race = await Promise.all([adapter.query(sql), adapter.query(sql)]);
      assert.equal(race.filter(casWon).length, 1);
      await adapter.query(`INSERT INTO ai_quota_counters
        (vpbx_user_uid, product, metric, period_start, limit_units, used_units, reserved_units, revision, updated_at)
        VALUES (8, 'speech_analytics', 'storage_bytes', '2026-09-01 00:00:00.000', 100, 0, 40, 1, ${now})`);
      const rows = await adapter.query("SELECT metric, reserved_units AS reserved FROM ai_quota_counters WHERE vpbx_user_uid=8");
      assert.equal(rows.length, 2);
    });

    await t.test('reservations enforce owner form, parent/operation pairing, and unique owner keys', async () => {
      await adapter.query(`INSERT INTO ai_usage_reservations
        (id, vpbx_user_uid, job_id, owner_key, metric, period_start, held_units, settled_units, state, expires_at, version, created_at, updated_at)
        VALUES ('res-job', 8, '${jobId}', 'job:${jobId}', 'audio_ms', '2026-09-01 00:00:00.000', 8, 0, 'held', '2026-09-19 13:00:00.000', 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_usage_reservations
        (id, vpbx_user_uid, job_id, provider_operation_id, parent_reservation_id, owner_key, metric, period_start, held_units, settled_units, state, expires_at, version, created_at, updated_at)
        VALUES ('res-op', 8, '${jobId}', '${opId}', 'res-job', 'operation:${opId}', 'audio_ms', '2026-09-01 00:00:00.000', 3, 0, 'held', '2026-09-19 13:00:00.000', 1, ${now}, ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_usage_reservations
        (id, vpbx_user_uid, job_id, owner_key, metric, period_start, held_units, settled_units, state, expires_at, version, created_at, updated_at)
        VALUES ('res-dup', 8, '${jobId}', 'job:${jobId}', 'audio_ms', '2026-09-01 00:00:00.000', 1, 0, 'held', '2026-09-19 13:00:00.000', 1, ${now}, ${now})`));
      await assert.rejects(adapter.query(`INSERT INTO ai_usage_reservations
        (id, vpbx_user_uid, job_id, owner_key, metric, period_start, held_units, settled_units, state, expires_at, version, created_at, updated_at)
        VALUES ('res-bad', 8, '${jobId}', 'nope', 'audio_ms', '2026-09-01 00:00:00.000', 1, 0, 'held', '2026-09-19 13:00:00.000', 1, ${now}, ${now})`));
      await assert.rejects(adapter.query(`INSERT INTO ai_usage_reservations
        (id, vpbx_user_uid, job_id, provider_operation_id, owner_key, metric, period_start, held_units, settled_units, state, expires_at, version, created_at, updated_at)
        VALUES ('res-mix', 8, '${jobId}', '${opId}', 'job:${jobId}', 'audio_ms', '2026-09-01 00:00:00.000', 1, 0, 'held', '2026-09-19 13:00:00.000', 1, ${now}, ${now})`));
    });

    await t.test('price revisions reject a fake-zero BYOK rate; events and ledger are unique/append-only', async () => {
      await adapter.query(`INSERT INTO ai_price_revisions
        (id, provider_uid, product, unit, currency, rate, scale, rounding_mode, money_policy, effective_at, config_digest, created_at)
        VALUES ('price-1', 'test', 'speech_analytics', 'audio_ms', 'RUB', 1.25, 2, 'half_up', 'shadow', ${now}, ${hash}, ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_price_revisions
        (id, provider_uid, product, unit, currency, rate, scale, rounding_mode, money_policy, effective_at, config_digest, created_at)
        VALUES ('price-zero', 'local', 'speech_analytics', 'audio_ms', 'RUB', 0, 2, 'half_up', 'local_byok', ${now}, ${hash}, ${now})`));
      await adapter.query(`INSERT INTO ai_price_revisions
        (id, provider_uid, product, unit, currency, rate, scale, rounding_mode, money_policy, effective_at, config_digest, created_at)
        VALUES ('price-byok', 'local', 'speech_analytics', 'audio_ms', NULL, NULL, 2, 'half_up', 'local_byok', ${now}, '${'cc'.repeat(32)}', ${now})`);
      await adapter.query(`INSERT INTO ai_usage_events
        (id, vpbx_user_uid, provider_operation_id, event_key, quantity, unit, source, price_revision_id, occurred_at)
        VALUES ('evt-1', 8, '${opId}', 'stt', 3, 'audio_ms', 'measured', 'price-1', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_usage_events
        (id, vpbx_user_uid, provider_operation_id, event_key, quantity, unit, source, price_revision_id, occurred_at)
        VALUES ('evt-2', 8, '${opId}', 'stt', 3, 'audio_ms', 'measured', 'price-1', ${now})`));
      await adapter.query(`INSERT INTO ai_usage_ledger
        (id, vpbx_user_uid, reservation_id, operation_id, entry_kind, sequence, units, amount_decimal, currency, price_revision_id, created_at)
        VALUES ('led-1', 8, 'res-op', 'operation:${opId}', 'settle', 1, 3, 3.75, 'RUB', 'price-1', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_usage_ledger
        (id, vpbx_user_uid, reservation_id, operation_id, entry_kind, sequence, units, amount_decimal, currency, price_revision_id, created_at)
        VALUES ('led-2', 8, 'res-op', 'operation:${opId}', 'settle', 1, 3, 3.75, 'RUB', 'price-1', ${now})`));
    });

    await t.test('usage journal has no billing wallet tables and wrong-tenant job FK fails', async () => {
      const tables = await adapter.query(postgres
        ? "SELECT tablename AS name FROM pg_tables WHERE schemaname='public'"
        : "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
      const names = tables.map(row => row.name || row.NAME);
      assert.ok(names.includes('ai_usage_ledger'));
      assert.ok(!names.includes('ai_wallet') && !names.includes('ai_cloud_wallet'));
      await assert.rejects(adapter.query(`INSERT INTO ai_usage_reservations
        (id, vpbx_user_uid, job_id, owner_key, metric, period_start, held_units, settled_units, state, expires_at, version, created_at, updated_at)
        VALUES ('res-x', 9, '${jobId}', 'job:${jobId}', 'audio_ms', '2026-09-01 00:00:00.000', 1, 0, 'held', '2026-09-19 13:00:00.000', 1, ${now}, ${now})`));
    });
  });
}
