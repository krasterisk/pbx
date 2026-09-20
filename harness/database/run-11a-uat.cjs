'use strict';
// Disposable AI-11 11A analytics LIVE-UAT. Wrap 10A I1 + live HTTP onboarding.
// Pilot A then pilot B parallel data. Eval report template. No I4/AMI/ARI.
// No local Docker. No cloud_wallet debit. Named remaining: local-AI / MET5.
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
const { buildEvalReport, writeEvalReport, REMAINING_GATES } = require('./analytics-uat.cjs');
const images = require('./images.json');

const args = process.argv.slice(2);
const selected = args.filter((value) => ['mysql', 'postgres'].includes(value));
if (args.some((value) => !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-11a-uat.cjs [mysql|postgres]');
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
  test(`${dialect}: 11A analytics LIVE-UAT + pilot A/B (${images[dialect]})`, { timeout: 720000 }, async (t) => {
    const postgres = dialect === 'postgres';
    const password = crypto.randomBytes(24).toString('hex');
    const dbPort = postgres ? 5432 : 3306;
    let container;
    try {
      container = await new GenericContainer(images[dialect])
        .withEnvironment(postgres
          ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_11a_admin' }
          : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_11a_admin' })
        .withExposedPorts(dbPort)
        .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
        .withStartupTimeout(180000)
        .start();
    } catch {
      throw new Error('11A environment unavailable: Docker/image startup failed. Acceptance is NOT skipped or passed.');
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
      DB_NAME: 'krasterisk_11a_admin',
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

    await t.test('LIVE-UAT: pilot A onboarding then pilot B parallel without cross-tenant', async () => {
      const dbName = `krasterisk_ci_${dialect}11a`;
      await admin.query(postgres ? `CREATE DATABASE "${dbName}"` : `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4`);
      await admin.close();
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
        const cdr = await inspect.query(postgres
          ? "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cdr'"
          : "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='cdr'");
        assert.equal(cdr.length, 0, 'analytics-only must not install cdr');
      } finally {
        await inspect.close();
      }

      const config = resolveDatabaseConfig(appEnv, { requireExplicitConnection: true });
      const port = await freePort();
      const backend = path.resolve(__dirname, '../../packages/backend');
      let output = '';
      child = spawn(process.execPath, [path.join(backend, 'dist-analytics/analytics.main.js')], {
        cwd: backend,
        env: {
          ...process.env,
          ...appEnv,
          NODE_ENV: 'development',
          BACKEND_PORT: String(port),
          JWT_SECRET: 'disposable-11a-analytics-jwt-secret-00000001',
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
        if (child.exitCode !== null) throw new Error(`analytics API exited: ${output.slice(-1200)}`);
        try {
          health = await fetch(`${api}/health`, { signal: AbortSignal.timeout(1000) });
          if (health.ok) break;
        } catch { /* wait */ }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert.equal(health?.status, 200, output.slice(-1200));
      const healthBody = await readJson(health, 200, output.slice(-1200));
      assert.equal(healthBody.profile, 'analytics-api');
      assert.equal(healthBody.productRuntime, 'not-installed');

      const login = await fetch(`${api}/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login: 'ci-tenant-a', password: fixturePassword }),
      });
      const { accessToken } = await readJson(login, 200, output.slice(-4000));
      const auth = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };

      await entitleCloudProduct(config, { slug: 'ci-tenant-a', product: 'speech_analytics' });

      const projectRes = await fetch(`${api}/speech-analytics/projects`, {
        method: 'POST', headers: auth, body: JSON.stringify({ name: 'Pilot' }),
      });
      const project = await readJson(projectRes, 201);
      assert.match(project.id, /^[0-9a-f-]{36}$/i);

      const publish = await fetch(`${api}/speech-analytics/projects/${project.id}/publish`, {
        method: 'POST', headers: auth, body: JSON.stringify({ operationKey: crypto.randomUUID() }),
      });
      await readJson(publish, [200, 201]);

      const keyRes = await fetch(`${api}/v1/integrations`, {
        method: 'POST', headers: auth,
        body: JSON.stringify({
          label: 'ingest', product: 'speech_analytics', operationId: crypto.randomUUID(),
        }),
      });
      const keyBody = await readJson(keyRes, 201);
      assert.equal(typeof keyBody.token, 'string');
      assert.match(keyBody.token, /^krint_v1_/);
      const keyId = keyBody.principalId;
      const krint = { authorization: `Bearer ${keyBody.token}`, 'content-type': 'application/json' };

      const grants = await fetch(`${api}/v1/integrations/${keyId}/grants`, {
        method: 'PUT', headers: auth,
        body: JSON.stringify({
          expectedRevision: '1',
          grants: [
            { resourceKind: 'project', resourceId: project.id, scope: 'analytics:upload' },
            { resourceKind: 'project', resourceId: project.id, scope: 'analytics:read' },
          ],
        }),
      });
      await readJson(grants, 200);

      const queryToken = await fetch(`${api}/v1/speech-analytics/capabilities?token=nope`, { headers: krint });
      assert.equal(queryToken.status, 400, 'query token must be refused');

      const suppliedTenant = await fetch(`${api}/v1/speech-analytics/uploads`, {
        method: 'POST', headers: krint,
        body: JSON.stringify({ projectId: project.id, expectedBytes: 64, tenantUid: 1 }),
      });
      assert.equal(suppliedTenant.status, 400);

      const cap = await fetch(`${api}/v1/speech-analytics/capabilities`, { headers: krint });
      const capBody = await readJson(cap, 200);
      assert.equal(capBody.nativeCaptureApply, false);
      assert.equal(capBody.ami, undefined);

      const uploadRes = await fetch(`${api}/v1/speech-analytics/uploads`, {
        method: 'POST', headers: krint,
        body: JSON.stringify({ projectId: project.id, expectedBytes: 64 }),
      });
      const upload = await readJson(uploadRes, 201);
      const bytesBase64 = Buffer.alloc(64, 1).toString('base64');
      const content = await fetch(`${api}/v1/speech-analytics/uploads/${upload.id}/content`, {
        method: 'PUT', headers: krint, body: JSON.stringify({ bytesBase64 }),
      });
      await readJson(content, 200);
      const complete = await fetch(`${api}/v1/speech-analytics/uploads/${upload.id}/complete`, {
        method: 'POST', headers: krint, body: JSON.stringify({}),
      });
      const completed = await readJson(complete, [200, 201]);
      assert.equal(completed.state, 'ready');

      const runRes = await fetch(`${api}/v1/speech-analytics/analysis-runs`, {
        method: 'POST',
        headers: { ...krint, 'Idempotency-Key': 'run-1' },
        body: JSON.stringify({
          projectId: project.id, assetId: completed.assetId, externalCallId: 'ext-1',
        }),
      });
      const runBody = await readJson(runRes, 202);
      const result = await fetch(`${api}/v1/speech-analytics/analysis-runs/${runBody.runId}/result`, { headers: krint });
      const resultBody = await readJson(result, 200);
      assert.ok(['queued', 'running', 'retry_wait', 'completed', 'partial'].includes(resultBody.run.state));

      const loginB = await fetch(`${api}/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login: 'ci-tenant-b', password: fixturePassword }),
      });
      const { accessToken: tokenB } = await readJson(loginB, 200);
      const authB = { authorization: `Bearer ${tokenB}`, 'content-type': 'application/json' };
      const asB = await fetch(`${api}/v1/speech-analytics/analysis-runs/${runBody.runId}/result`, {
        headers: { authorization: `Bearer ${tokenB}` },
      });
      assert.ok([401, 403, 404].includes(asB.status), `tenant B must not read A run, got ${asB.status}`);

      // Pilot B: entitle + own project/upload (parallel data, no cross-tenant).
      await entitleCloudProduct(config, { slug: 'ci-tenant-b', product: 'speech_analytics' });
      const projectBRes = await fetch(`${api}/speech-analytics/projects`, {
        method: 'POST', headers: authB, body: JSON.stringify({ name: 'Pilot-B' }),
      });
      const projectB = await readJson(projectBRes, 201);
      const publishB = await fetch(`${api}/speech-analytics/projects/${projectB.id}/publish`, {
        method: 'POST', headers: authB, body: JSON.stringify({ operationKey: crypto.randomUUID() }),
      });
      await readJson(publishB, [200, 201]);
      const keyBRes = await fetch(`${api}/v1/integrations`, {
        method: 'POST', headers: authB,
        body: JSON.stringify({
          label: 'ingest-b', product: 'speech_analytics', operationId: crypto.randomUUID(),
        }),
      });
      const keyB = await readJson(keyBRes, 201);
      assert.match(keyB.token, /^krint_v1_/);
      const grantsB = await fetch(`${api}/v1/integrations/${keyB.principalId}/grants`, {
        method: 'PUT', headers: authB,
        body: JSON.stringify({
          expectedRevision: '1',
          grants: [
            { resourceKind: 'project', resourceId: projectB.id, scope: 'analytics:upload' },
            { resourceKind: 'project', resourceId: projectB.id, scope: 'analytics:read' },
          ],
        }),
      });
      await readJson(grantsB, 200);
      const krintB = { authorization: `Bearer ${keyB.token}`, 'content-type': 'application/json' };
      const uploadBRes = await fetch(`${api}/v1/speech-analytics/uploads`, {
        method: 'POST', headers: krintB,
        body: JSON.stringify({ projectId: projectB.id, expectedBytes: 64 }),
      });
      const uploadB = await readJson(uploadBRes, 201);
      await readJson(await fetch(`${api}/v1/speech-analytics/uploads/${uploadB.id}/content`, {
        method: 'PUT', headers: krintB,
        body: JSON.stringify({ bytesBase64: Buffer.alloc(64, 2).toString('base64') }),
      }), 200);
      const completedB = await readJson(await fetch(`${api}/v1/speech-analytics/uploads/${uploadB.id}/complete`, {
        method: 'POST', headers: krintB, body: JSON.stringify({}),
      }), [200, 201]);
      assert.equal(completedB.state, 'ready');
      const runB = await readJson(await fetch(`${api}/v1/speech-analytics/analysis-runs`, {
        method: 'POST',
        headers: { ...krintB, 'Idempotency-Key': 'run-b-1' },
        body: JSON.stringify({
          projectId: projectB.id, assetId: completedB.assetId, externalCallId: 'ext-b-1',
        }),
      }), 202);
      // A must not read B's run via A's integration key.
      const aReadsB = await fetch(`${api}/v1/speech-analytics/analysis-runs/${runB.runId}/result`, {
        headers: krint,
      });
      assert.ok([401, 403, 404].includes(aReadsB.status), `A must not read B run, got ${aReadsB.status}`);

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
      assert.ok(tags.has('Speech Analytics Public'), `tags=${[...tags].join(',')}`);
      assert.ok(tags.has('AI Integrations'), `tags=${[...tags].join(',')}`);
      const paths = Object.keys(spec.paths ?? {}).join('\n');
      assert.match(paths, /speech-analytics\/uploads/);
      assert.match(paths, /analysis-runs/);

      for (const absent of ['routes', 'ai-agents', 'public/voice-robots', 'internal/dialplan/notify']) {
        assert.equal((await fetch(`${api}/${absent}`)).status, 404, `${absent} must be absent`);
      }
      assert.doesNotMatch(output, /AMI connection|ARI websocket|asterisk manager|ami\.connect/i);

      const report = buildEvalReport({
        dialect,
        schemaVersion: CURRENT_SCHEMA,
        pilots: [
          { tenant: 'ci-tenant-a', projectId: project.id, runId: runBody.runId },
          { tenant: 'ci-tenant-b', projectId: projectB.id, runId: runB.runId },
        ],
        isolation: {
          bCannotReadA: [401, 403, 404].includes(asB.status),
          aCannotReadB: [401, 403, 404].includes(aReadsB.status),
        },
      });
      assert.equal(report.productSlaClaimed, false);
      assert.deepEqual(report.remainingGates, [...REMAINING_GATES]);
      const outDir = process.env.AI11_11A_OUT
        || path.join(__dirname, '../../.planning/initiatives/ai-products/evidence/11a');
      const outFile = writeEvalReport(outDir, dialect, report);
      t.diagnostic(`eval=${outFile}`);
    });
  });
}
