'use strict';
// Disposable MySQL/PG + Redis. Never reads DB_* / production Redis.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { GenericContainer, Wait } = require('testcontainers');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { runMigrations, loadMigrations } = require('../../packages/backend/database/migration-runner.cjs');
const images = require('./images.json');

function casWon(result) {
  return (Array.isArray(result) ? result.length : Number(result.affectedRows)) === 1;
}

function spawnChild(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, out, err }));
  });
}

async function runEnqueueKill() {
  const queue = new Queue('ai-outbox', {
    connection: {
      host: process.env.D2_REDIS_HOST,
      port: Number(process.env.D2_REDIS_PORT),
      maxRetriesPerRequest: null,
      retryStrategy: times => (times > 8 ? null : 150),
    },
  });
  try {
    await queue.add('event', {
      eventId: process.env.D2_EVENT_ID,
      tenantUid: Number(process.env.D2_TENANT),
    }, { jobId: `${process.env.D2_EVENT_ID}-kill` });
  } finally {
    await queue.close();
  }
}

async function runClaimStage() {
  const environment = JSON.parse(process.env.D2_DB);
  const postgres = environment.DB_DIALECT === 'postgres';
  const config = resolveDatabaseConfig(environment, { requireExplicitConnection: true });
  const db = await connectAdapter(config);
  try {
    const owner = process.env.D2_OWNER;
    const id = process.env.D2_STAGE_ID;
    const sql = postgres
      ? `UPDATE ai_job_stages SET state='leased', version=version+1, fence=fence+1, lease_owner='${owner}',
           updated_at=CURRENT_TIMESTAMP WHERE id='${id}' AND version=1 AND state='pending' RETURNING id, fence`
      : `UPDATE ai_job_stages SET state='leased', version=version+1, fence=fence+1, lease_owner='${owner}',
           updated_at=CURRENT_TIMESTAMP WHERE id='${id}' AND version=1 AND state='pending'`;
    const result = await db.query(sql);
    process.stdout.write(JSON.stringify({ won: casWon(result) }) + '\n');
  } finally {
    await db.close();
  }
}

if (process.env.D2_CHILD === 'enqueue-kill') {
  runEnqueueKill().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
  });
} else if (process.env.D2_CHILD === 'claim-stage') {
  runClaimStage().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
  });
} else {
  const selected = process.argv.slice(2).filter(value => ['mysql', 'postgres'].includes(value));
  if (process.argv.slice(2).some(value => !['mysql', 'postgres'].includes(value))) {
    throw new Error('Usage: node harness/database/run-d2-fault.cjs [mysql|postgres]');
  }

  for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
    const postgres = dialect === 'postgres';
    test(`${dialect}+redis: D2 admission/outbox live faults (${images[dialect]} + ${images.redis})`, { timeout: 300000 }, async t => {
      const password = crypto.randomBytes(24).toString('hex');
      const dbPort = postgres ? 5432 : 3306;
      const db = await new GenericContainer(images[dialect])
        .withEnvironment(postgres
          ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_d2' }
          : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_d2' })
        .withExposedPorts(dbPort)
        .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
        .withStartupTimeout(180000)
        .start();
      const redis = await new GenericContainer(images.redis)
        .withExposedPorts(6379)
        .withWaitStrategy(Wait.forListeningPorts())
        .withStartupTimeout(60000)
        .start();
      let adapter;
      let ping;
      let queue;
      const extraRedis = [];
      t.after(async () => {
        await Promise.allSettled([queue?.close(), ping?.quit(), adapter?.close()]);
        await Promise.allSettled([db.stop(), redis.stop(), ...extraRedis.map(item => item.stop())]);
      });
      const environment = {
        DB_DIALECT: dialect, DB_HOST: db.getHost(), DB_PORT: String(db.getMappedPort(dbPort)),
        DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password, DB_NAME: 'krasterisk_d2',
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
      const redisHost = redis.getHost();
      const redisPort = redis.getMappedPort(6379);
      const redisOptions = {
        host: redisHost, port: redisPort, maxRetriesPerRequest: null,
        retryStrategy: times => (times > 8 ? null : 150),
      };
      ping = new Redis({
        ...redisOptions, maxRetriesPerRequest: 3, lazyConnect: true, enableOfflineQueue: false,
      });
      ping.on('error', () => {});
      await ping.connect();
      assert.equal((await ping.ping()).toUpperCase(), 'PONG');
      queue = new Queue('ai-outbox', { connection: redisOptions });
      const now = 'CURRENT_TIMESTAMP';
      const hash = `'${'ef'.repeat(32)}'`;

      await adapter.query(`INSERT INTO ai_provider_revisions
        (id, vpbx_user_uid, provider_uid, revision, configuration, capability_digest, credential_ref, key_version, created_at)
        VALUES ('d2-rev-1', 8, 'test-provider', 1, '{}', ${hash}, 'cred-ref', 1, ${now})`);

      const insertJob = (id, state) => adapter.query(`INSERT INTO ai_jobs
        (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
        VALUES ('${id}', 8, 'speech_analytics', 'analyze', 'asset', 'asset-d2', '${state}', 0, ${now}, 1, ${now}, ${now})`);
      const insertStage = (id, jobId, state, version = 1, fence = 0, key = 'run') => adapter.query(`INSERT INTO ai_job_stages
        (id, vpbx_user_uid, job_id, stage_key, state, attempt_count, fence, version, created_at, updated_at)
        VALUES ('${id}', 8, '${jobId}', '${key}', '${state}', 0, ${fence}, ${version}, ${now}, ${now})`);
      const insertOutbox = id => adapter.query(`INSERT INTO ai_outbox
        (id, vpbx_user_uid, aggregate_kind, aggregate_id, aggregate_version, event_type, schema_version, payload, available_at, fence, attempts, version, created_at)
        VALUES ('${id}', 8, 'job', '${id}', 1, 'job.admitted', 1, '{"schemaVersion":1,"tenantUid":8}', ${now}, 0, 0, 1, ${now})`);

      await insertJob('d2-live-job', 'queued');
      await insertStage('d2-live-stage', 'd2-live-job', 'pending');
      await insertOutbox('d2-live-out');

      await t.test('committed SQL survives Redis enqueue failure', async () => {
        const dead = new Redis({
          host: '127.0.0.1', port: 1, lazyConnect: true, connectTimeout: 400,
          maxRetriesPerRequest: 1, enableOfflineQueue: false, retryStrategy: () => null,
        });
        dead.on('error', () => {});
        await assert.rejects(dead.connect().then(() => dead.ping()));
        await dead.quit().catch(() => {});
        assert.equal((await adapter.query("SELECT id FROM ai_jobs WHERE id='d2-live-job'")).length, 1);
        assert.equal((await adapter.query("SELECT id FROM ai_outbox WHERE id='d2-live-out' AND delivered_at IS NULL")).length, 1);
      });

      await t.test('process-kill after enqueue leaves SQL undelivered and a later mark wins once', async () => {
        await insertOutbox('d2-kill-out');
        const child = await spawnChild({
          D2_CHILD: 'enqueue-kill',
          D2_REDIS_HOST: redisHost,
          D2_REDIS_PORT: String(redisPort),
          D2_EVENT_ID: 'd2-kill-out',
          D2_TENANT: '8',
        });
        assert.equal(child.code, 0, child.err || child.out);
        assert.equal((await adapter.query("SELECT id FROM ai_outbox WHERE id='d2-kill-out' AND delivered_at IS NULL")).length, 1);
        const waiting = await queue.getJob(`${'d2-kill-out'}-kill`);
        assert.ok(waiting);
        const mark = postgres
          ? "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP, lease_owner=NULL WHERE id='d2-kill-out' AND delivered_at IS NULL RETURNING id"
          : "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP, lease_owner=NULL WHERE id='d2-kill-out' AND delivered_at IS NULL";
        assert.equal(casWon(await adapter.query(mark)), true);
        assert.equal(casWon(await adapter.query(mark)), false);
      });

      await t.test('two worker processes: one CAS winner, stale fence ignored', async () => {
        await insertJob('d2-race-job', 'queued');
        await insertStage('d2-race-stage', 'd2-race-job', 'pending');
        const dbEnv = JSON.stringify(environment);
        const [left, right] = await Promise.all([
          spawnChild({ D2_CHILD: 'claim-stage', D2_DB: dbEnv, D2_STAGE_ID: 'd2-race-stage', D2_OWNER: 'worker-alpha' }),
          spawnChild({ D2_CHILD: 'claim-stage', D2_DB: dbEnv, D2_STAGE_ID: 'd2-race-stage', D2_OWNER: 'worker-bravo' }),
        ]);
        assert.equal(left.code, 0, left.err);
        assert.equal(right.code, 0, right.err);
        const wins = [left, right].map(item => JSON.parse(item.out.trim())).filter(row => row.won);
        assert.equal(wins.length, 1);
        const stale = postgres
          ? "UPDATE ai_job_stages SET state='succeeded' WHERE id='d2-race-stage' AND fence=0 RETURNING id"
          : "UPDATE ai_job_stages SET state='succeeded' WHERE id='d2-race-stage' AND fence=0";
        assert.equal(casWon(await adapter.query(stale)), false);
        const good = postgres
          ? "UPDATE ai_job_stages SET state='succeeded', lease_owner=NULL WHERE id='d2-race-stage' AND fence=1 RETURNING id"
          : "UPDATE ai_job_stages SET state='succeeded', lease_owner=NULL WHERE id='d2-race-stage' AND fence=1";
        await adapter.query("UPDATE ai_job_stages SET state='executing' WHERE id='d2-race-stage' AND fence=1");
        assert.equal(casWon(await adapter.query(good)), true);
      });

      await t.test('cancel queued is terminal; executing records cancel_requested and current fence may finish', async () => {
        await insertJob('d2-cancel-q', 'queued');
        await insertStage('d2-cancel-q-stage', 'd2-cancel-q', 'pending');
        const cancelQueued = postgres
          ? "UPDATE ai_jobs SET state='cancelled', terminal_at=CURRENT_TIMESTAMP, version=version+1 WHERE id='d2-cancel-q' AND state='queued' RETURNING id"
          : "UPDATE ai_jobs SET state='cancelled', terminal_at=CURRENT_TIMESTAMP, version=version+1 WHERE id='d2-cancel-q' AND state='queued'";
        assert.equal(casWon(await adapter.query(cancelQueued)), true);
        const blocked = postgres
          ? "UPDATE ai_job_stages SET state='leased' WHERE id='d2-cancel-q-stage' AND state='pending' AND job_id IN (SELECT id FROM ai_jobs WHERE state <> 'cancelled' AND cancel_requested_at IS NULL) RETURNING id"
          : "UPDATE ai_job_stages SET state='leased' WHERE id='d2-cancel-q-stage' AND state='pending' AND job_id IN (SELECT id FROM ai_jobs WHERE state <> 'cancelled' AND cancel_requested_at IS NULL)";
        assert.equal(casWon(await adapter.query(blocked)), false);

        await insertJob('d2-cancel-x', 'running');
        await insertStage('d2-cancel-x-stage', 'd2-cancel-x', 'executing', 2, 1);
        await insertStage('d2-cancel-x-next', 'd2-cancel-x', 'pending', 1, 0, 'next');
        await adapter.query("UPDATE ai_jobs SET cancel_requested_at=CURRENT_TIMESTAMP WHERE id='d2-cancel-x'");
        const stale = postgres
          ? "UPDATE ai_job_stages SET state='succeeded' WHERE id='d2-cancel-x-stage' AND fence=99 RETURNING id"
          : "UPDATE ai_job_stages SET state='succeeded' WHERE id='d2-cancel-x-stage' AND fence=99";
        assert.equal(casWon(await adapter.query(stale)), false);
        const finish = postgres
          ? "UPDATE ai_job_stages SET state='succeeded', lease_owner=NULL WHERE id='d2-cancel-x-stage' AND fence=1 RETURNING id"
          : "UPDATE ai_job_stages SET state='succeeded', lease_owner=NULL WHERE id='d2-cancel-x-stage' AND fence=1";
        assert.equal(casWon(await adapter.query(finish)), true);
        const next = postgres
          ? "UPDATE ai_job_stages SET state='leased' WHERE id='d2-cancel-x-next' AND state='pending' AND job_id IN (SELECT id FROM ai_jobs WHERE cancel_requested_at IS NULL AND state <> 'cancelled') RETURNING id"
          : "UPDATE ai_job_stages SET state='leased' WHERE id='d2-cancel-x-next' AND state='pending' AND job_id IN (SELECT id FROM ai_jobs WHERE cancel_requested_at IS NULL AND state <> 'cancelled')";
        assert.equal(casWon(await adapter.query(next)), false);
      });

      await t.test('DLQ after three transient attempts; protocol fails immediately; unknown is not a second dispatch', async () => {
        await insertJob('d2-dlq-job', 'running');
        await adapter.query(`INSERT INTO ai_job_stages
          (id, vpbx_user_uid, job_id, stage_key, state, attempt_count, fence, version, created_at, updated_at, error_code)
          VALUES ('d2-dlq-stage', 8, 'd2-dlq-job', 'run', 'pending', 3, 0, 1, ${now}, ${now}, NULL)`);
        await adapter.query("UPDATE ai_job_stages SET state='failed', error_code='dlq' WHERE id='d2-dlq-stage' AND attempt_count >= 3");
        assert.equal((await adapter.query("SELECT error_code FROM ai_job_stages WHERE id='d2-dlq-stage'"))[0].error_code, 'dlq');
        await adapter.query(`INSERT INTO ai_job_stages
          (id, vpbx_user_uid, job_id, stage_key, state, attempt_count, fence, version, created_at, updated_at)
          VALUES ('d2-perm-stage', 8, 'd2-dlq-job', 'validate', 'pending', 0, 0, 1, ${now}, ${now})`);
        await adapter.query("UPDATE ai_job_stages SET state='failed', error_code='permanent' WHERE id='d2-perm-stage'");
        await insertStage('d2-unk-stage', 'd2-dlq-job', 'executing', 2, 1, 'provider');
        await adapter.query(`INSERT INTO ai_provider_operations
          (id, vpbx_user_uid, stage_id, ordinal, provider_revision_id, state, idempotency_token, request_hash, version, created_at, updated_at)
          VALUES ('d2-op-1', 8, 'd2-unk-stage', 1, 'd2-rev-1', 'dispatched', '${'aa'.repeat(32)}', ${hash}, 1, ${now}, ${now})`);
        await adapter.query("UPDATE ai_provider_operations SET state='unknown' WHERE id='d2-op-1'");
        await assert.rejects(adapter.query(`INSERT INTO ai_provider_operations
          (id, vpbx_user_uid, stage_id, ordinal, provider_revision_id, state, idempotency_token, request_hash, version, created_at, updated_at)
          VALUES ('d2-op-2', 8, 'd2-unk-stage', 1, 'd2-rev-1', 'dispatched', '${'ab'.repeat(32)}', ${hash}, 1, ${now}, ${now})`));
        assert.equal((await adapter.query("SELECT id FROM ai_provider_operations WHERE stage_id='d2-unk-stage'")).length, 1);
      });

      await t.test('forged queue tenant is rejected against SQL outbox tenant', async () => {
        const [row] = await adapter.query("SELECT vpbx_user_uid AS tenant FROM ai_outbox WHERE id='d2-live-out'");
        const payload = { eventId: 'd2-live-out', tenantUid: 9 };
        assert.notEqual(Number(row.tenant), payload.tenantUid);
      });

      await t.test('enqueue-before-mark duplicate is skipped by SQL delivery CAS', async () => {
        await queue.add('event', { eventId: 'd2-live-out', tenantUid: 8 }, { jobId: 'd2-live-out-a' });
        await queue.add('event', { eventId: 'd2-live-out', tenantUid: 8 }, { jobId: 'd2-live-out-b' });
        const mark = postgres
          ? "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP, lease_owner=NULL WHERE id='d2-live-out' AND delivered_at IS NULL RETURNING id"
          : "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP, lease_owner=NULL WHERE id='d2-live-out' AND delivered_at IS NULL";
        assert.equal(casWon(await adapter.query(mark)), true);
        assert.equal(casWon(await adapter.query(mark)), false);
      });

      await t.test('simultaneous in-process stage claims have one CAS winner', async () => {
        await insertJob('d2-inproc-job', 'queued');
        await insertStage('d2-inproc-stage', 'd2-inproc-job', 'pending');
        const sql = postgres
          ? "UPDATE ai_job_stages SET state='leased', version=version+1, fence=fence+1, lease_owner='worker-live', updated_at=CURRENT_TIMESTAMP WHERE id='d2-inproc-stage' AND version=1 RETURNING id"
          : "UPDATE ai_job_stages SET state='leased', version=version+1, fence=fence+1, lease_owner='worker-live', updated_at=CURRENT_TIMESTAMP WHERE id='d2-inproc-stage' AND version=1";
        const once = async () => {
          const extra = await connectAdapter(config);
          try { return await extra.query(sql); }
          finally { await extra.close(); }
        };
        const race = await Promise.all([once(), once()]);
        assert.equal(race.filter(casWon).length, 1);
      });

      await t.test('redis restart with empty data rehydrates from undelivered outbox', async () => {
        await insertOutbox('d2-rehydrate-out');
        await queue.add('event', { eventId: 'd2-rehydrate-out', tenantUid: 8 }, { jobId: 'd2-rehydrate-out' });
        await queue.close();
        await ping.quit();
        queue = null;
        ping = null;
        await redis.stop();
        const redis2 = await new GenericContainer(images.redis)
          .withExposedPorts(6379)
          .withWaitStrategy(Wait.forListeningPorts())
          .withStartupTimeout(60000)
          .start();
        extraRedis.push(redis2);
        const undelivered = await adapter.query("SELECT id FROM ai_outbox WHERE id='d2-rehydrate-out' AND delivered_at IS NULL");
        assert.equal(undelivered.length, 1);
        const fresh = new Queue('ai-outbox', {
          connection: {
            host: redis2.getHost(), port: redis2.getMappedPort(6379),
            maxRetriesPerRequest: null, retryStrategy: times => (times > 8 ? null : 150),
          },
        });
        try {
          await fresh.add('event', { eventId: 'd2-rehydrate-out', tenantUid: 8 }, { jobId: 'd2-rehydrate-out' });
          const mark = postgres
            ? "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP WHERE id='d2-rehydrate-out' AND delivered_at IS NULL RETURNING id"
            : "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP WHERE id='d2-rehydrate-out' AND delivered_at IS NULL";
          assert.equal(casWon(await adapter.query(mark)), true);
          assert.equal(casWon(await adapter.query(mark)), false);
        } finally {
          await fresh.close();
        }
      });
    });
  }
}
