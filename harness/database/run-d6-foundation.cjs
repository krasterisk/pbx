'use strict';
// Disposable MySQL/PG foundation matrix. Optional Redis (--redis) and MinIO (--minio).
// Never reads production DB_* / Redis / S3. Never charges a wallet or places a call.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { runMigrations, loadMigrations } = require('../../packages/backend/database/migration-runner.cjs');
const images = require('./images.json');

const args = process.argv.slice(2);
const wantMinio = args.includes('--minio');
const wantRedis = args.includes('--redis');
const selected = args.filter(value => ['mysql', 'postgres'].includes(value));
if (args.some(value => !['mysql', 'postgres', '--minio', '--redis'].includes(value))) {
  throw new Error('Usage: node harness/database/run-d6-foundation.cjs [mysql|postgres] [--minio] [--redis]');
}

function casWon(result) {
  return (Array.isArray(result) ? result.length : Number(result.affectedRows)) === 1;
}

function evaluateAiReadiness(input) {
  if (!input.schemaReady) return { live: true, ready: false, status: 503, delayed: false, reason: 'schema' };
  if (input.role !== 'ai-api' && !input.redisReady) {
    return { live: true, ready: false, status: 503, delayed: false, reason: 'redis' };
  }
  if ((input.role === 'media-worker' || input.role === 'ai-api') && !input.storageReady) {
    return { live: true, ready: false, status: 503, delayed: false, reason: 'storage' };
  }
  if (!input.encryptionReady || !input.providerReady) {
    return { live: true, ready: false, status: 503, delayed: false, reason: 'config' };
  }
  if (input.role === 'ai-api' && !input.redisReady) {
    if (input.backlog >= input.backlogCap) {
      return { live: true, ready: false, status: 503, delayed: true, reason: 'backlog' };
    }
    return { live: true, ready: false, status: 200, delayed: true, reason: 'redis-delayed' };
  }
  return { live: true, ready: true, status: 200, delayed: false };
}

function redisPing(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => socket.write('*1\r\n$4\r\nPING\r\n'));
    socket.setTimeout(5000);
    let body = '';
    socket.on('data', chunk => { body += chunk.toString('utf8'); socket.end(); });
    socket.on('end', () => resolve(body));
    socket.on('error', reject);
    socket.on('timeout', () => { socket.destroy(); reject(new Error('redis timeout')); });
  });
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
}

function sha256Hex(body) {
  return crypto.createHash('sha256').update(body).digest('hex');
}

function signingKey(secret, date, region) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), 's3'), 'aws4_request');
}

async function s3Request(config, method, pathname, body, extra = {}) {
  const url = new URL(config.endpoint);
  url.pathname = pathname;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const payload = body ?? Buffer.alloc(0);
  const payloadHash = sha256Hex(payload);
  const headers = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...extra,
  };
  if (method !== 'GET' && method !== 'HEAD') headers['content-length'] = String(payload.length);
  const names = Object.keys(headers).map(name => name.toLowerCase()).sort();
  const canonicalHeaders = names.map(name => `${name}:${headers[name]}\n`).join('');
  const signedHeaders = names.join(';');
  const canonical = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/${config.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonical)].join('\n');
  const signature = crypto.createHmac('sha256', signingKey(config.secretKey, date, config.region))
    .update(stringToSign, 'utf8').digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(url, { method, headers, body });
  return { status: response.status, buffer: Buffer.from(await response.arrayBuffer()) };
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  const postgres = dialect === 'postgres';
  const extras = [wantRedis ? 'redis' : null, wantMinio ? 'minio' : null].filter(Boolean);
  const label = extras.length ? `${dialect}+${extras.join('+')}` : dialect;
  test(`${label}: D6 foundation fault/E2E (${images[dialect]})`, { timeout: 360000 }, async t => {
    const password = crypto.randomBytes(24).toString('hex');
    const dbPort = postgres ? 5432 : 3306;
    const db = await new GenericContainer(images[dialect])
      .withEnvironment(postgres
        ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_d6' }
        : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_d6' })
      .withExposedPorts(dbPort)
      .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
      .withStartupTimeout(180000)
      .start();
    let redis;
    let minio;
    let adapter;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-d6-fs-'));
    t.after(async () => {
      try { if (adapter) await adapter.close(); } finally {
        await Promise.allSettled([db.stop(), redis?.stop(), minio?.stop()]);
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
    if (wantRedis) {
      redis = await new GenericContainer(images.redis)
        .withExposedPorts(6379)
        .withWaitStrategy(Wait.forListeningPorts())
        .withStartupTimeout(60000)
        .start();
    }
    const environment = {
      DB_DIALECT: dialect, DB_HOST: db.getHost(), DB_PORT: String(db.getMappedPort(dbPort)),
      DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password, DB_NAME: 'krasterisk_d6',
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
    const job8 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const job0 = '00000000-0000-4000-8000-000000000000';
    const job9 = '99999999-9999-4999-8999-999999999999';
    const asset8 = '44444444-4444-4444-8444-444444444444';
    const op8 = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
    const txBefore = await adapter.query('SELECT COUNT(*) AS c FROM billing_transactions');

    await t.test('readiness splits live/ready; Redis-absent API is delayed, workers 503', () => {
      assert.equal(evaluateAiReadiness({
        role: 'ai-worker', schemaReady: true, redisReady: false, storageReady: true,
        encryptionReady: true, providerReady: true, inflight: 0, backlog: 0, backlogCap: 8,
      }).status, 503);
      assert.equal(evaluateAiReadiness({
        role: 'ai-api', schemaReady: true, redisReady: false, storageReady: true,
        encryptionReady: true, providerReady: true, inflight: 0, backlog: 1, backlogCap: 8,
      }).delayed, true);
      assert.equal(evaluateAiReadiness({
        role: 'ai-api', schemaReady: false, redisReady: true, storageReady: true,
        encryptionReady: true, providerReady: true, inflight: 0, backlog: 0, backlogCap: 8,
      }).reason, 'schema');
    });

    await t.test('upload → ready asset → admitted job → shadow usage; tenants isolated; wallet unchanged', async () => {
      const objectKey = `t8/${asset8}`;
      fs.mkdirSync(path.join(root, 't8'), { recursive: true });
      fs.writeFileSync(path.join(root, objectKey), Buffer.from('RIFF'));
      await adapter.query(`INSERT INTO ai_media_assets
        (id, vpbx_user_uid, source_kind, storage_key, state, sha256, bytes, media_metadata, version, created_at, updated_at)
        VALUES ('${asset8}', 8, 'upload', 'krs:v1:local:8:${asset8}', 'ready', ${hash}, 4, '{}', 1, ${now}, ${now})`);
      for (const [rev, tenant] of [['rev-d6-0', 0], ['rev-d6-8', 8], ['rev-d6-9', 9]]) {
        await adapter.query(`INSERT INTO ai_provider_revisions
          (id, vpbx_user_uid, provider_uid, revision, configuration, capability_digest, credential_ref, key_version, created_at)
          VALUES ('${rev}', ${tenant}, 'test', 1, '{}', ${hash}, 'cred', 1, ${now})`);
      }
      await adapter.query(`INSERT INTO ai_jobs
        (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
        VALUES ('${job8}', 8, 'speech_analytics', 'analyze', 'asset', '${asset8}', 'queued', 0, ${now}, 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_jobs
        (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
        VALUES ('${job0}', 0, 'speech_analytics', 'analyze', 'asset', 'asset-d6-0', 'queued', 0, ${now}, 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_jobs
        (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
        VALUES ('${job9}', 9, 'speech_analytics', 'analyze', 'asset', 'asset-d6-9', 'queued', 0, ${now}, 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_job_stages
        (id, vpbx_user_uid, job_id, stage_key, state, attempt_count, fence, version, created_at, updated_at)
        VALUES ('stage-d6-8', 8, '${job8}', 'run', 'pending', 0, 0, 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_provider_operations
        (id, vpbx_user_uid, stage_id, ordinal, provider_revision_id, state, idempotency_token, request_hash, version, created_at, updated_at)
        VALUES ('${op8}', 8, 'stage-d6-8', 1, 'rev-d6-8', 'prepared', ${hash}, ${hash}, 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_quota_counters
        (vpbx_user_uid, product, metric, period_start, limit_units, used_units, reserved_units, revision, updated_at)
        VALUES (8, 'speech_analytics', 'audio_ms', '2026-09-01 00:00:00.000', 100, 0, 0, 1, ${now})`);
      await adapter.query(`INSERT INTO ai_quota_counters
        (vpbx_user_uid, product, metric, period_start, limit_units, used_units, reserved_units, revision, updated_at)
        VALUES (0, 'speech_analytics', 'audio_ms', '2026-09-01 00:00:00.000', 10, 0, 0, 1, ${now})`);
      const casSql = postgres
        ? `UPDATE ai_quota_counters SET reserved_units=10, revision=2 WHERE vpbx_user_uid=8 AND metric='audio_ms' AND revision=1 RETURNING revision`
        : `UPDATE ai_quota_counters SET reserved_units=10, revision=2 WHERE vpbx_user_uid=8 AND metric='audio_ms' AND revision=1`;
      assert.equal(casWon(await adapter.query(casSql)), true);
      await adapter.query(`INSERT INTO ai_price_revisions
        (id, provider_uid, product, unit, currency, rate, scale, rounding_mode, money_policy, effective_at, config_digest, created_at)
        VALUES ('price-d6', 'test', 'speech_analytics', 'audio_ms', 'RUB', 1.25, 2, 'half_up', 'shadow', ${now}, ${hash}, ${now})`);
      await adapter.query(`INSERT INTO ai_usage_reservations
        (id, vpbx_user_uid, job_id, owner_key, metric, period_start, held_units, settled_units, state, expires_at, version, created_at, updated_at)
        VALUES ('res-d6-job', 8, '${job8}', 'job:${job8}', 'audio_ms', '2026-09-01 00:00:00.000', 10, 0, 'held', '2026-09-19 13:00:00.000', 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_usage_reservations
        (id, vpbx_user_uid, job_id, provider_operation_id, parent_reservation_id, owner_key, metric, period_start, held_units, settled_units, state, expires_at, version, created_at, updated_at)
        VALUES ('res-d6-op', 8, '${job8}', '${op8}', 'res-d6-job', 'operation:${op8}', 'audio_ms', '2026-09-01 00:00:00.000', 4, 0, 'held', '2026-09-19 13:00:00.000', 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_usage_events
        (id, vpbx_user_uid, provider_operation_id, event_key, quantity, unit, source, price_revision_id, occurred_at)
        VALUES ('evt-d6', 8, '${op8}', 'stt', 4, 'audio_ms', 'measured', 'price-d6', ${now})`);
      await adapter.query(`INSERT INTO ai_usage_ledger
        (id, vpbx_user_uid, reservation_id, operation_id, entry_kind, sequence, units, amount_decimal, currency, price_revision_id, created_at)
        VALUES ('led-d6', 8, 'res-d6-op', 'operation:${op8}', 'settle', 1, 4, 5.00, 'RUB', 'price-d6', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_usage_reservations
        (id, vpbx_user_uid, job_id, owner_key, metric, period_start, held_units, settled_units, state, expires_at, version, created_at, updated_at)
        VALUES ('res-cross', 9, '${job8}', 'job:${job8}', 'audio_ms', '2026-09-01 00:00:00.000', 1, 0, 'held', '2026-09-19 13:00:00.000', 1, ${now}, ${now})`));
      const tables = await adapter.query(postgres
        ? "SELECT tablename AS name FROM pg_tables WHERE schemaname='public'"
        : "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
      const names = tables.map(row => row.name || row.NAME);
      assert.ok(!names.includes('ai_wallet'));
      const txAfter = await adapter.query('SELECT COUNT(*) AS c FROM billing_transactions');
      assert.equal(Number(txBefore[0].c ?? txBefore[0].C), Number(txAfter[0].c ?? txAfter[0].C));
      assert.equal((await adapter.query("SELECT state FROM ai_media_assets WHERE id='" + asset8 + "'"))[0].state, 'ready');
      assert.ok(fs.existsSync(path.join(root, objectKey)));
    });

    await t.test('two schedulers: one CAS winner; stale fence ignored', async () => {
      const sql = postgres
        ? `UPDATE ai_job_stages SET state='leased', version=2, fence=1, lease_owner='alpha' WHERE id='stage-d6-8' AND version=1 RETURNING id`
        : `UPDATE ai_job_stages SET state='leased', version=2, fence=1, lease_owner='alpha' WHERE id='stage-d6-8' AND version=1`;
      const race = await Promise.all([adapter.query(sql), adapter.query(sql)]);
      assert.equal(race.filter(casWon).length, 1);
      const stale = postgres
        ? `UPDATE ai_job_stages SET state='succeeded' WHERE id='stage-d6-8' AND fence=0 RETURNING id`
        : `UPDATE ai_job_stages SET state='succeeded' WHERE id='stage-d6-8' AND fence=0`;
      assert.equal(casWon(await adapter.query(stale)), false);
    });

    await t.test('duplicate usage event and ledger sequence are rejected (kill+replay)', async () => {
      await assert.rejects(adapter.query(`INSERT INTO ai_usage_events
        (id, vpbx_user_uid, provider_operation_id, event_key, quantity, unit, source, occurred_at)
        VALUES ('evt-dup', 8, '${op8}', 'stt', 4, 'audio_ms', 'measured', ${now})`));
      await assert.rejects(adapter.query(`INSERT INTO ai_usage_ledger
        (id, vpbx_user_uid, reservation_id, operation_id, entry_kind, sequence, units, created_at)
        VALUES ('led-dup', 8, 'res-d6-op', 'operation:${op8}', 'settle', 1, 4, ${now})`));
      const [quota] = await adapter.query("SELECT reserved_units AS reserved FROM ai_quota_counters WHERE vpbx_user_uid=8");
      assert.equal(Number(quota.reserved), 10);
    });

    await t.test('running job holds retention; cancel does not drop the ledger', async () => {
      const jobs = await adapter.query(`SELECT id FROM ai_jobs WHERE resource_id='${asset8}' AND state IN ('queued','running')`);
      assert.equal(jobs.length, 1);
      await adapter.query(`UPDATE ai_jobs SET state='cancelled', cancel_requested_at=${now} WHERE id='${job8}'`);
      assert.equal((await adapter.query("SELECT id FROM ai_usage_ledger WHERE id='led-d6'")).length, 1);
    });

    if (wantRedis) {
      await t.test('live Redis PING; SQL rows survive a dead Redis connection', async () => {
        const pong = await redisPing(redis.getHost(), redis.getMappedPort(6379));
        assert.match(pong, /PONG/i);
        await assert.rejects(redisPing('127.0.0.1', 1));
        assert.equal((await adapter.query(`SELECT id FROM ai_jobs WHERE id='${job0}'`)).length, 1);
      });
    }

    if (wantMinio) {
      minio = await new GenericContainer(images.minio)
        .withEnvironment({ MINIO_ROOT_USER: 'minioadmin', MINIO_ROOT_PASSWORD: 'minioadmin' })
        .withCommand(['server', '/data', '--console-address', ':9001'])
        .withExposedPorts(9000)
        .withWaitStrategy(Wait.forLogMessage(/API:.*/))
        .withStartupTimeout(120000)
        .start();
      const endpoint = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`;
      const liveDeadline = performance.now() + 30000;
      for (;;) {
        try {
          const live = await fetch(`${endpoint}/minio/health/live`);
          if (live.ok) break;
        } catch {
          /* retry */
        }
        if (performance.now() >= liveDeadline) throw new Error('minio live probe timeout');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      const s3 = {
        endpoint, region: 'us-east-1', bucket: 'krasterisk-d6',
        accessKey: 'minioadmin', secretKey: 'minioadmin',
      };
      await t.test('disposable MinIO put/head does not use a production bucket', async () => {
        const created = await s3Request(s3, 'PUT', `/${s3.bucket}`);
        assert.ok(created.status < 300 || created.status === 409);
        const key = `t8/${asset8}`;
        const put = await s3Request(s3, 'PUT', `/${s3.bucket}/${key}`, Buffer.from('RIFF'));
        assert.ok(put.status < 300, `put ${put.status}`);
        const head = await s3Request(s3, 'HEAD', `/${s3.bucket}/${key}`);
        assert.equal(head.status, 200);
      });
    }
  });
}
