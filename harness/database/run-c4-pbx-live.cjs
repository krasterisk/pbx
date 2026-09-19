'use strict';
// Disposable full-PBX / community-pbx public-robot CURL smoke. Remote Testcontainers only.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { runMigrations, loadMigrations } = require('../../packages/backend/database/migration-runner.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { seed } = require('../../packages/backend/database/seed-ci.cjs');
const { entitleCloudProduct } = require('./entitle-cloud-product.cjs');
const images = require('./images.json');

const dialect = process.argv[2];
const composition = process.argv[3] || 'community';
if (!['mysql', 'postgres'].includes(dialect) || !['community', 'full'].includes(composition)
  || process.argv.length > 4) {
  throw new Error('Usage: node harness/database/run-c4-pbx-live.cjs mysql|postgres [community|full]');
}

function curl(url, extra = []) {
  const result = spawnSync('curl', [
    '-sS', '--max-time', '10', '--ipv4', '--http1.1', '--noproxy', '*',
    '-D', '-', '-o', '-', ...extra, url,
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`curl failed (${result.status}): ${result.stderr || result.error?.message}`);
  }
  const text = result.stdout;
  const split = text.indexOf('\r\n\r\n') >= 0 ? '\r\n\r\n' : '\n\n';
  const index = text.indexOf(split);
  const headers = index >= 0 ? text.slice(0, index) : text;
  const body = index >= 0 ? text.slice(index + split.length) : '';
  const statusLine = headers.split(/\r?\n/).find(line => /^HTTP\//i.test(line)) ?? '';
  return { status: Number(statusLine.split(/\s+/)[1]), headers, body };
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
  const dbName = 'krasterisk_ci_c4pbx';
  const backend = path.resolve(__dirname, '../../packages/backend');
  const entry = composition === 'community'
    ? path.join(backend, 'dist-community/community.main.js')
    : path.join(backend, 'dist/main.js');
  if (!fs.existsSync(entry)) throw new Error(`missing compiled ${composition} entry ${entry}`);
  const publicKey = crypto.randomBytes(24).toString('hex');
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
      CI: 'true', DB_CORE_TEST_PROFILE: 'true',
      DB_DIALECT: dialect, DB_HOST: container.getHost(), DB_PORT: String(container.getMappedPort(dbPort)),
      DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password, DB_NAME: dbName,
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
    await runMigrations({ config, migrations: loadMigrations(dialect) });
    const fixturePassword = crypto.randomBytes(24).toString('hex');
    await seed({ ...environment, CI: 'true', CI_SEED_PASSWORD: fixturePassword });
    await entitleCloudProduct(config, { slug: 'ci-tenant-a', product: 'speech_analytics' });
    await entitleCloudProduct(config, { slug: 'ci-tenant-a', product: 'ai_voice_robots' });
    const port = await freePort();
    let output = '';
    child = spawn(process.execPath, [entry], {
      cwd: backend,
      env: {
        ...process.env, ...environment, BACKEND_PORT: String(port), NODE_ENV: 'test',
        JWT_SECRET: 'disposable-c4-pbx-jwt-secret-00000000000001',
        JWT_REFRESH_SECRET: 'disposable-c4-pbx-refresh-secret-00000001',
        CC_AI_KEY_SECRET: crypto.randomBytes(32).toString('hex'),
        VOICE_ROBOTS_PUBLIC_API_KEY: publicKey,
        DEPLOYMENT_MODE: 'CLOUD',
        AMI_HOST: '127.0.0.1', AMI_PORT: '1', ARI_URL: 'http://127.0.0.1:1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', chunk => { output = (output + chunk.toString()).slice(-20000); });
    child.stderr.on('data', chunk => { output = (output + chunk.toString()).slice(-20000); });
    const base = `http://127.0.0.1:${port}/api`;
    const deadline = Date.now() + 90000;
    let health;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`${composition} exited before health: ${output.slice(-2000)}`);
      try {
        health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1500) });
        if (health.ok) break;
      } catch { /* wait */ }
      try {
        const docs = await fetch(`${base}/docs`, { signal: AbortSignal.timeout(1500) });
        if (docs.ok) { health = docs; break; }
      } catch { /* community may omit swagger */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(health?.ok, `${composition} health did not start: ${output.slice(-2000)}`);
    const missing = curl(`${base}/public/voice-robots`);
    assert.equal(missing.status, 401, 'v3 public robots stay closed without a key');
    assert.notEqual(missing.status, 404, 'v3 public robots URL must not be removed');
    const allowed = curl(`${base}/public/voice-robots`, ['-H', `x-api-key: ${publicKey}`]);
    assert.equal(allowed.status, 200, 'v3 curl client with x-api-key must succeed');
    const payload = JSON.parse(allowed.body);
    assert.ok(Array.isArray(payload), 'public robots list is a JSON array');
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'ci-tenant-a', password: fixturePassword }),
    });
    assert.equal(login.status, 200, 'seeded PBX tenant must log in');
    const session = await login.json();
    assert.ok(session.accessToken);
    assert.ok(session.refreshToken, 'full-PBX login issues a refresh token');
    console.log(`${dialect} ${composition} public-robots CURL: 401 without key, 200 with x-api-key; login 200`);
    if (process.env.C4_KEEP_ALIVE === '1') {
      console.log(`C4_LIVE_READY port=${port} login=ci-tenant-a password=${fixturePassword} publicKey=${publicKey}`);
      await new Promise(resolve => {
        const stop = () => resolve();
        process.on('SIGTERM', stop);
        process.on('SIGINT', stop);
        child.once('exit', stop);
      });
    }
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

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
