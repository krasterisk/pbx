'use strict';
// Disposable 10R robots-only smoke. I1 install + live HTTP onboarding.
// No local Docker. No I4 native CDR/queue_log claim. No cloud_wallet debit.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { cleanInstall, CURRENT_SCHEMA } = require('./clean-install.cjs');
const { entitleCloudProduct } = require('./entitle-cloud-product.cjs');
const { evaluateSipProfile } = require('../../packages/backend/dist-robot/modules/ai-voice/realtime-session');
const images = require('./images.json');

const args = process.argv.slice(2);
const selected = args.filter((value) => ['mysql', 'postgres'].includes(value));
if (args.some((value) => !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-10r-smoke.cjs [mysql|postgres]');
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function readJson(response, expected, extra = '') {
  const text = await response.text();
  const allowed = Array.isArray(expected) ? expected : [expected];
  assert.ok(allowed.includes(response.status), `${response.status} expected ${allowed.join('|')}: ${text}\n${extra}`);
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`non-JSON ${response.status}: ${text.slice(0, 400)}`);
  }
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  test(`${dialect}: 10R robots-only installer + live API (${images[dialect]})`, { timeout: 720000 }, async (t) => {
    const postgres = dialect === 'postgres';
    const password = crypto.randomBytes(24).toString('hex');
    const dbPort = postgres ? 5432 : 3306;
    let container;
    try {
      container = await new GenericContainer(images[dialect])
        .withEnvironment(postgres
          ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_10r_admin' }
          : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_10r_admin' })
        .withExposedPorts(dbPort)
        .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
        .withStartupTimeout(180000)
        .start();
    } catch {
      throw new Error('10R environment unavailable: Docker/image startup failed. Acceptance is NOT skipped or passed.');
    }
    let child;
    let admin;
    t.after(async () => {
      try { if (admin) await admin.close(); } catch { /* closed */ }
      if (child && child.exitCode === null) {
        child.kill('SIGTERM');
        await Promise.race([
          new Promise((resolve) => child.once('exit', resolve)),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
        if (child.exitCode === null) child.kill('SIGKILL');
      }
      await container.stop();
    });

    const environment = {
      DB_DIALECT: dialect,
      DB_HOST: container.getHost(),
      DB_PORT: String(container.getMappedPort(dbPort)),
      DB_USER: postgres ? 'postgres' : 'root',
      DB_PASSWORD: password,
      DB_NAME: 'krasterisk_10r_admin',
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

    await t.test('I1 robot-api install then provider→publish→SIP→drain without analytics', async () => {
      const dbName = `krasterisk_ci_${dialect}10r`;
      await admin.query(postgres ? `CREATE DATABASE "${dbName}"` : `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4`);
      await admin.close();
      const fixturePassword = crypto.randomBytes(24).toString('hex');
      const appEnv = {
        ...environment,
        DB_NAME: dbName,
        DB_SCHEMA_PROFILE: 'robot-api',
        KRASTERISK_BINARY: 'robot-api',
        CI: 'true',
        CI_SEED_PASSWORD: fixturePassword,
      };
      const installed = await cleanInstall(['--apply', '--seed-ci'], appEnv);
      assert.equal(installed.readiness.schemaVersion, CURRENT_SCHEMA);
      const inspect = await connectAdapter(resolveDatabaseConfig(appEnv, { requireExplicitConnection: true }));
      let tenantUid;
      let agentUid;
      try {
        const cdr = await inspect.query(postgres
          ? "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cdr'"
          : "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='cdr'");
        assert.equal(cdr.length, 0, 'robots-only must not install cdr');
        const tenants = await inspect.query(
          postgres ? 'SELECT vpbx_user_uid FROM tenants WHERE slug = $1' : 'SELECT vpbx_user_uid FROM tenants WHERE slug = ?',
          ['ci-tenant-a'],
        );
        tenantUid = tenants[0].vpbx_user_uid;
        const providers = await inspect.query(
          postgres
            ? 'SELECT uid FROM cc_ai_providers WHERE vpbx_user_uid = $1 ORDER BY uid'
            : 'SELECT uid FROM cc_ai_providers WHERE vpbx_user_uid = ? ORDER BY uid',
          [tenantUid],
        );
        const providerUid = providers[0].uid;
        await inspect.query(
          postgres
            ? `INSERT INTO cc_ai_agents (name, unique_id, mode, greeting, instruction, model_profile_id, stt_profile_id, tts_profile_id, channel_kind, enabled, created_at, updated_at, vpbx_user_uid)
               VALUES ($1, $2, 'cascade', $3, $4, $5, $5, $5, 'local', TRUE, NOW(), NOW(), $6)`
            : `INSERT INTO cc_ai_agents (name, unique_id, mode, greeting, instruction, model_profile_id, stt_profile_id, tts_profile_id, channel_kind, enabled, created_at, updated_at, vpbx_user_uid)
               VALUES (?, ?, 'cascade', ?, ?, ?, ?, ?, 'local', 1, NOW(), NOW(), ?)`,
          postgres
            ? ['Pilot', 'pilot-a', 'здравствуйте', 'помогайте', providerUid, tenantUid]
            : ['Pilot', 'pilot-a', 'здравствуйте', 'помогайте', providerUid, providerUid, providerUid, tenantUid],
        );
        const agents = await inspect.query(
          postgres
            ? 'SELECT uid FROM cc_ai_agents WHERE unique_id = $1 AND vpbx_user_uid = $2'
            : 'SELECT uid FROM cc_ai_agents WHERE unique_id = ? AND vpbx_user_uid = ?',
          ['pilot-a', tenantUid],
        );
        agentUid = agents[0].uid;
      } finally {
        await inspect.close();
      }

      const config = resolveDatabaseConfig(appEnv, { requireExplicitConnection: true });
      const port = await freePort();
      const backend = path.resolve(__dirname, '../../packages/backend');
      let output = '';
      child = spawn(process.execPath, [path.join(backend, 'dist-robot/robot.main.js')], {
        cwd: backend,
        env: {
          ...process.env,
          ...appEnv,
          NODE_ENV: 'development',
          BACKEND_PORT: String(port),
          JWT_SECRET: 'disposable-10r-robots-jwt-secret-00000000001',
          DEPLOYMENT_MODE: 'CLOUD',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const append = (chunk) => {
        output += chunk.toString();
        if (output.length > 40000) output = `${output.slice(0, 8000)}\n...\n${output.slice(-16000)}`;
      };
      child.stdout.on('data', append);
      child.stderr.on('data', append);
      const api = `http://127.0.0.1:${port}/api`;
      const deadline = Date.now() + 45000;
      let health;
      while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`robot API exited: ${output.slice(-1200)}`);
        try {
          health = await fetch(`${api}/health`, { signal: AbortSignal.timeout(1000) });
          if (health.ok) break;
        } catch { /* wait */ }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const healthBody = await readJson(health, 200, output.slice(-1200));
      assert.equal(healthBody.profile, 'robot-api');
      assert.equal(healthBody.productRuntime, 'not-installed');

      const login = await fetch(`${api}/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login: 'ci-tenant-a', password: fixturePassword }),
      });
      const { accessToken } = await readJson(login, 200, output.slice(-4000));
      const auth = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };

      await entitleCloudProduct(config, { slug: 'ci-tenant-a', product: 'ai_voice_robots' });

      const queryToken = await fetch(`${api}/v1/ai-voice/capabilities?token=nope`, { headers: auth });
      assert.equal(queryToken.status, 400, 'query token must be refused');

      const cap = await fetch(`${api}/v1/ai-voice/capabilities`, { headers: auth });
      const capBody = await readJson(cap, 200);
      assert.equal(capBody.externalSip, false);
      assert.equal(capBody.ami, undefined);

      const publish = await fetch(`${api}/v1/ai-voice/agents/${agentUid}/publish`, {
        method: 'POST', headers: auth, body: JSON.stringify({ operationKey: 'pub-1' }),
      });
      const version = await readJson(publish, [200, 201]);
      assert.match(version.id, /^[0-9a-f-]{36}$/i);

      const depRes = await fetch(`${api}/v1/ai-voice/deployments`, {
        method: 'POST', headers: auth,
        body: JSON.stringify({ agentUid, kind: 'browser_test', versionId: version.id }),
      });
      const deployment = await readJson(depRes, 201);
      assert.match(deployment.id, /^[0-9a-f-]{36}$/i);

      const ready = await fetch(`${api}/v1/ai-voice/deployments/${deployment.id}/ready`, {
        method: 'PUT', headers: auth, body: JSON.stringify({ ready: true }),
      });
      const readyBody = await readJson(ready, 200);
      assert.equal(readyBody.status, 'ready');

      const udp = await fetch(`${api}/v1/ai-voice/sip-connections`, {
        method: 'POST', headers: auth, body: JSON.stringify({ name: 'edge', transport: 'udp' }),
      });
      const udpBody = await readJson(udp, [200, 201]);
      assert.equal(udpBody.status, 'draft');
      assert.equal(udpBody.ready, false);
      assert.equal(udpBody.reason, null);

      const tls = await fetch(`${api}/v1/ai-voice/sip-connections`, {
        method: 'POST', headers: auth, body: JSON.stringify({ name: 'tls-lab', transport: 'tls' }),
      });
      const tlsBody = await readJson(tls, [200, 201]);
      assert.equal(tlsBody.status, 'disabled');
      assert.equal(tlsBody.reason, 'sip_profile_unsupported');
      assert.equal(tlsBody.ready, false);

      assert.equal(evaluateSipProfile({ transport: 'udp', nativePbx: true, i4Evidence: false }).reason, 'native_pbx_gated');

      const ticketRes = await fetch(`${api}/v1/ai-voice/deployments/${deployment.id}/browser-ticket`, {
        method: 'POST', headers: auth,
      });
      const ticket = await readJson(ticketRes, [200, 201]);
      const ticketsDb = await connectAdapter(config);
      let ticketRow;
      try {
        const rows = await ticketsDb.query(
          postgres
            ? 'SELECT id, node_id, channel_uniqueid FROM ai_voice_tickets WHERE vpbx_user_uid = $1 AND id = $2'
            : 'SELECT id, node_id, channel_uniqueid FROM ai_voice_tickets WHERE vpbx_user_uid = ? AND id = ?',
          [tenantUid, ticket.id],
        );
        ticketRow = rows[0];
      } finally {
        await ticketsDb.close();
      }
      assert.ok(ticketRow?.node_id);

      const drain = await fetch(`${api}/v1/ai-voice/drain`, { method: 'POST', headers: auth });
      const drainBody = await readJson(drain, [200, 201]);
      assert.equal(drainBody.admissionsStopped, true);
      assert.equal(drainBody.liveSip, false);
      assert.ok(drainBody.drained.includes(deployment.id));

      const admit = await fetch(`${api}/v1/ai-voice/admissions`, {
        method: 'POST',
        headers: { ...auth, 'Idempotency-Key': 'adm-1' },
        body: JSON.stringify({
          ticketId: ticketRow.id,
          nodeId: ticketRow.node_id,
          channelUniqueid: ticketRow.channel_uniqueid,
          deploymentId: deployment.id,
          ingressKind: 'browser_test',
          ingressKey: 'k1',
        }),
      });
      const stopped = await readJson(admit, 409);
      assert.equal(stopped.code, 'admissions_stopped');

      const loginB = await fetch(`${api}/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login: 'ci-tenant-b', password: fixturePassword }),
      });
      const { accessToken: tokenB } = await readJson(loginB, 200);
      const asB = await fetch(`${api}/v1/ai-voice/deployments/${deployment.id}/ready`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${tokenB}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ready: true }),
      });
      assert.ok([401, 403, 404].includes(asB.status), `tenant B must not mutate A deployment, got ${asB.status}`);
      const sipB = await fetch(`${api}/v1/ai-voice/sip-connections`, {
        method: 'POST',
        headers: { authorization: `Bearer ${tokenB}`, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'b', transport: 'udp' }),
      });
      assert.equal(sipB.status, 403);

      for (const absent of [
        'speech-analytics/projects', 'v1/speech-analytics/uploads',
        'routes', 'public/voice-robots', 'internal/dialplan/notify',
      ]) {
        assert.equal((await fetch(`${api}/${absent}`)).status, 404, `${absent} must be absent`);
      }

      const openapi = await fetch(`${api}/docs-json`);
      const spec = await readJson(openapi, 200);
      const tags = new Set((spec.tags ?? []).map((item) => item.name));
      for (const pathItem of Object.values(spec.paths ?? {})) {
        for (const op of Object.values(pathItem ?? {})) {
          if (op && typeof op === 'object' && Array.isArray(op.tags)) {
            for (const tag of op.tags) tags.add(tag);
          }
        }
      }
      assert.ok(tags.has('AI Voice'), `tags=${[...tags].join(',')}`);
      const paths = Object.keys(spec.paths ?? {}).join('\n');
      assert.match(paths, /ai-voice\/deployments/);
      assert.match(paths, /sip-connections/);
      assert.doesNotMatch(output, /AMI connection|ARI websocket|asterisk manager|ami\.connect/i);
    });
  });
}
