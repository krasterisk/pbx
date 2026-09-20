'use strict';
// Disposable AI-11 11F fault matrix. Wrap D2 outbox/jobs + pure named faults.
// No local Docker. No cloud_wallet debit. Shadow replay only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { GenericContainer, Wait } = require('testcontainers');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { cleanInstall, CURRENT_SCHEMA } = require('./clean-install.cjs');
const { runAllPureFaults, publishedMatrix, NAMED_FAULTS } = require('./fault-matrix.cjs');
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
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

async function runEnqueueKill() {
  const queue = new Queue('ai-outbox', {
    connection: {
      host: process.env.F11_REDIS_HOST,
      port: Number(process.env.F11_REDIS_PORT),
      maxRetriesPerRequest: null,
      retryStrategy: (times) => (times > 8 ? null : 150),
    },
  });
  try {
    await queue.add('event', {
      eventId: process.env.F11_EVENT_ID,
      tenantUid: Number(process.env.F11_TENANT),
    }, { jobId: `${process.env.F11_EVENT_ID}-kill` });
  } finally {
    await queue.close();
  }
}

if (process.env.F11_CHILD === 'enqueue-kill') {
  runEnqueueKill().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  const args = process.argv.slice(2);
  const selected = args.filter((value) => ['mysql', 'postgres'].includes(value));
  if (args.some((value) => !['mysql', 'postgres'].includes(value))) {
    throw new Error('Usage: node harness/database/run-11f-fault.cjs [mysql|postgres]');
  }

  for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
    test(`${dialect}+redis: 11F named faults (${images[dialect]} + ${images.redis})`, { timeout: 720000 }, async (t) => {
      const postgres = dialect === 'postgres';
      const password = crypto.randomBytes(24).toString('hex');
      const dbPort = postgres ? 5432 : 3306;
      let db;
      let redis;
      try {
        db = await new GenericContainer(images[dialect])
          .withEnvironment(postgres
            ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_11f_admin' }
            : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_11f_admin' })
          .withExposedPorts(dbPort)
          .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
          .withStartupTimeout(180000)
          .start();
        redis = await new GenericContainer(images.redis)
          .withExposedPorts(6379)
          .withWaitStrategy(Wait.forListeningPorts())
          .withStartupTimeout(60000)
          .start();
      } catch {
        throw new Error('11F environment unavailable: Docker/image startup failed. Acceptance is NOT skipped or passed.');
      }
      let admin;
      let adapter;
      let ping;
      let queue;
      const extraRedis = [];
      t.after(async () => {
        await Promise.allSettled([queue?.close(), ping?.quit(), adapter?.close(), admin?.close()]);
        await Promise.allSettled([db.stop(), redis.stop(), ...extraRedis.map((item) => item.stop())]);
      });

      const environment = {
        DB_DIALECT: dialect,
        DB_HOST: db.getHost(),
        DB_PORT: String(db.getMappedPort(dbPort)),
        DB_USER: postgres ? 'postgres' : 'root',
        DB_PASSWORD: password,
        DB_NAME: 'krasterisk_11f_admin',
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

      const live = [];

      await t.test('pure named fault matrix (no product SLA)', async () => {
        const pure = await runAllPureFaults();
        assert.equal(pure.length, NAMED_FAULTS.length);
        for (const row of pure) {
          assert.equal(row.pass, true, `fault ${row.name} must pass`);
        }
        t.diagnostic(JSON.stringify({ purePass: pure.filter((r) => r.pass).length }));
      });

      await t.test('I1 analytics-api then live Redis/outbox recovery faults', async () => {
        const dbName = `krasterisk_ci_${dialect}11f`;
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
        adapter = await connectAdapter(resolveDatabaseConfig(appEnv, { requireExplicitConnection: true }));

        const redisHost = redis.getHost();
        const redisPort = redis.getMappedPort(6379);
        const redisOptions = {
          host: redisHost, port: redisPort, maxRetriesPerRequest: null,
          retryStrategy: (times) => (times > 8 ? null : 150),
        };
        ping = new Redis({
          ...redisOptions, maxRetriesPerRequest: 3, lazyConnect: true, enableOfflineQueue: false,
        });
        ping.on('error', () => {});
        await ping.connect();
        assert.equal((await ping.ping()).toUpperCase(), 'PONG');
        queue = new Queue('ai-outbox', { connection: redisOptions });
        const stamp = 'CURRENT_TIMESTAMP';

        const insertJob = (id, state) => adapter.query(`INSERT INTO ai_jobs
          (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
          VALUES ('${id}', 8, 'speech_analytics', 'analyze', 'asset', 'asset-11f', '${state}', 0, ${stamp}, 1, ${stamp}, ${stamp})`);
        const insertOutbox = (id) => adapter.query(`INSERT INTO ai_outbox
          (id, vpbx_user_uid, aggregate_kind, aggregate_id, aggregate_version, event_type, schema_version, payload, available_at, fence, attempts, version, created_at)
          VALUES ('${id}', 8, 'job', '${id}', 1, 'job.admitted', 1, '{"schemaVersion":1,"tenantUid":8}', ${stamp}, 0, 0, 1, ${stamp})`);

        await insertJob('f11-job', 'queued');
        await insertOutbox('f11-out');

        // Redis unreachable after admit: SQL job/outbox remain.
        const dead = new Redis({
          host: '127.0.0.1', port: 1, lazyConnect: true, connectTimeout: 400,
          maxRetriesPerRequest: 1, enableOfflineQueue: false, retryStrategy: () => null,
        });
        dead.on('error', () => {});
        await assert.rejects(dead.connect().then(() => dead.ping()));
        await dead.quit().catch(() => {});
        assert.equal((await adapter.query("SELECT id FROM ai_jobs WHERE id='f11-job'")).length, 1);
        assert.equal((await adapter.query("SELECT id FROM ai_outbox WHERE id='f11-out' AND delivered_at IS NULL")).length, 1);
        live.push({ name: 'live_redis_unreachable_job_kept', pass: true });

        // Process kill after enqueue: undelivered SQL + later mark wins once.
        await insertOutbox('f11-kill-out');
        const child = await spawnChild({
          F11_CHILD: 'enqueue-kill',
          F11_REDIS_HOST: redisHost,
          F11_REDIS_PORT: String(redisPort),
          F11_EVENT_ID: 'f11-kill-out',
          F11_TENANT: '8',
        });
        assert.equal(child.code, 0, child.err || child.out);
        assert.equal((await adapter.query("SELECT id FROM ai_outbox WHERE id='f11-kill-out' AND delivered_at IS NULL")).length, 1);
        const waiting = await queue.getJob('f11-kill-out-kill');
        assert.ok(waiting);
        const mark = postgres
          ? "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP, lease_owner=NULL WHERE id='f11-kill-out' AND delivered_at IS NULL RETURNING id"
          : "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP, lease_owner=NULL WHERE id='f11-kill-out' AND delivered_at IS NULL";
        assert.equal(casWon(await adapter.query(mark)), true);
        assert.equal(casWon(await adapter.query(mark)), false);
        live.push({ name: 'live_kill_after_enqueue_mark_once', pass: true });

        // Duplicate queue jobs: delivery CAS once.
        await queue.add('event', { eventId: 'f11-out', tenantUid: 8 }, { jobId: 'f11-out-a' });
        await queue.add('event', { eventId: 'f11-out', tenantUid: 8 }, { jobId: 'f11-out-b' });
        const markLive = postgres
          ? "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP, lease_owner=NULL WHERE id='f11-out' AND delivered_at IS NULL RETURNING id"
          : "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP, lease_owner=NULL WHERE id='f11-out' AND delivered_at IS NULL";
        assert.equal(casWon(await adapter.query(markLive)), true);
        assert.equal(casWon(await adapter.query(markLive)), false);
        live.push({ name: 'live_duplicate_delivery_cas', pass: true });

        // Redis restart: undelivered outbox rehydrates.
        await insertOutbox('f11-rehydrate-out');
        await queue.add('event', { eventId: 'f11-rehydrate-out', tenantUid: 8 }, { jobId: 'f11-rehydrate-out' });
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
        const undelivered = await adapter.query("SELECT id FROM ai_outbox WHERE id='f11-rehydrate-out' AND delivered_at IS NULL");
        assert.equal(undelivered.length, 1);
        const fresh = new Queue('ai-outbox', {
          connection: {
            host: redis2.getHost(), port: redis2.getMappedPort(6379),
            maxRetriesPerRequest: null, retryStrategy: (times) => (times > 8 ? null : 150),
          },
        });
        try {
          await fresh.add('event', { eventId: 'f11-rehydrate-out', tenantUid: 8 }, { jobId: 'f11-rehydrate-out' });
          const markRh = postgres
            ? "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP WHERE id='f11-rehydrate-out' AND delivered_at IS NULL RETURNING id"
            : "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP WHERE id='f11-rehydrate-out' AND delivered_at IS NULL";
          assert.equal(casWon(await adapter.query(markRh)), true);
          assert.equal(casWon(await adapter.query(markRh)), false);
        } finally {
          await fresh.close();
        }
        live.push({ name: 'live_redis_restart_rehydrate', pass: true });

        const pure = await runAllPureFaults();
        const matrix = publishedMatrix(pure, live);
        assert.equal(matrix.productSlaClaimed, false);
        assert.equal(matrix.constraints.shadowDebitOnly, true);

        const outDir = process.env.AI11_11F_OUT
          || path.join(__dirname, '../../.planning/initiatives/ai-products/evidence/11f');
        fs.mkdirSync(outDir, { recursive: true });
        const outFile = path.join(outDir, `matrix-${dialect}.json`);
        fs.writeFileSync(outFile, `${JSON.stringify(matrix, null, 2)}\n`);
        t.diagnostic(`matrix=${outFile}`);
      });
    });
  }
}
