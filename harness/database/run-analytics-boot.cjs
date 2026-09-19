'use strict';
// Disposable standalone API smoke. Run only on the designated DB test server.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { runMigrations, loadMigrations } = require('../../packages/backend/database/migration-runner.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { seed } = require('../../packages/backend/database/seed-ci.cjs');
const images = require('./images.json');

const dialect = process.argv[2];
const product = process.argv[3] || 'analytics';
if (!['mysql', 'postgres'].includes(dialect) || !['analytics', 'robot'].includes(product)
  || process.argv.length > 4) {
  throw new Error('Usage: node harness/database/run-analytics-boot.cjs mysql|postgres [analytics|robot]');
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function main() {
  const postgres = dialect === 'postgres';
  const password = crypto.randomBytes(24).toString('hex');
  const dbPort = postgres ? 5432 : 3306;
  const dbName = `krasterisk_ci_${product}_boot`;
  const profile = product === 'analytics' ? 'analytics-api' : 'robot-api';
  const container = await new GenericContainer(images[dialect])
    .withEnvironment(postgres
      ? { POSTGRES_PASSWORD: password, POSTGRES_DB: dbName }
      : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: dbName })
    .withExposedPorts(dbPort)
    .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
    .withStartupTimeout(180000)
    .start();
  let child;
  try {
    const environment = {
      DB_DIALECT: dialect, DB_HOST: container.getHost(), DB_PORT: String(container.getMappedPort(dbPort)),
      DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password,
      DB_NAME: dbName, DB_SCHEMA_PROFILE: profile,
    };
    const config = resolveDatabaseConfig(environment, { requireExplicitConnection: true });
    const readyDeadline = Date.now() + 60000;
    for (;;) {
      try {
        const ready = await connectAdapter(config);
        await ready.close();
        break;
      } catch (error) {
        if (Date.now() >= readyDeadline || ![
          'PROTOCOL_CONNECTION_LOST', 'ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', '57P03',
        ].includes(error.code)) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    await runMigrations({ config, migrations: loadMigrations(dialect, profile), profile });
    const fixturePassword = crypto.randomBytes(24).toString('hex');
    await seed({ ...environment, CI: 'true', CI_SEED_PASSWORD: fixturePassword });
    const port = await freePort();
    const backend = path.resolve(__dirname, '../../packages/backend');
    let output = '';
    child = spawn(process.execPath, [path.join(backend, `dist-${product}/${product}.main.js`)], {
      cwd: backend,
      env: { ...process.env, ...environment, BACKEND_PORT: String(port),
        JWT_SECRET: 'disposable-analytics-boot-jwt-secret-00000001', NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', chunk => { output = (output + chunk.toString()).slice(-8000); });
    child.stderr.on('data', chunk => { output = (output + chunk.toString()).slice(-8000); });
    const base = `http://127.0.0.1:${port}/api`;
    const deadline = Date.now() + 30000;
    let health;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Analytics API exited before health: ${output.slice(-1000)}`);
      try {
        health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
        if (health.ok) break;
      } catch { /* wait for application readiness */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.equal(health?.status, 200, `Analytics API health did not start: ${output.slice(-1000)}`);
    assert.deepEqual(await health.json(), { status: 'ok', profile,
      productRuntime: 'not-installed' });
    const rejectedLogin = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'nobody@example.test', password: 'wrong' }),
    });
    assert.equal(rejectedLogin.status, 401, 'standalone login must reject unknown users');
    const acceptedLogin = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'ci-tenant-a', password: fixturePassword }),
    });
    assert.equal(acceptedLogin.status, 200, 'seeded tenant must be able to log in');
    const { accessToken } = await acceptedLogin.json();
    assert.ok(accessToken, 'login must issue an access token');
    const authorizedList = await fetch(`${base}/v1/integrations`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(authorizedList.status, 200, 'tenant JWT must access its scoped integrations');
    const status = async route => (await fetch(`${base}/${route}`)).status;
    assert.equal(await status('v1/integrations/self/capabilities'), 401);
    for (const absent of ['routes', 'ai-agents', 'public/voice-robots',
      'internal/dialplan/notify', 'internal/dialplan/route']) {
      assert.equal(await status(absent), 404, `${absent} must be absent from analytics composition`);
    }
    console.log(`${dialect} ${product} API boot: health 200; login 200/401; tenant integration list 200; unauthenticated integration 401; PBX routes 404`);
  } finally {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        new Promise(resolve => setTimeout(resolve, 5000)),
      ]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    await container.stop();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
