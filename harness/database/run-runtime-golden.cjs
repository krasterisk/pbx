'use strict';
// Fresh containers only. Run on CI or the designated remote test server, never
// on the Windows development host where local Docker is prohibited.
const crypto = require('node:crypto');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { loadMigrations, runMigrations } = require('../../packages/backend/database/migration-runner.cjs');
const { seed } = require('../../packages/backend/database/seed-ci.cjs');
const { main: installCdr } = require('./cdr-golden.cjs');
const { main: coreSmoke } = require('./core-api-smoke.cjs');
const { main: cdrSmoke } = require('./cdr-api-smoke.cjs');
const { main: callcenterGolden } = require('./callcenter-golden.cjs');
const { main: voiceRobotGolden } = require('./voice-robot-tag-golden.cjs');
const images = require('./images.json');

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function main(dialect) {
  if (!['mysql', 'postgres'].includes(dialect)) throw new Error('Usage: node harness/database/run-runtime-golden.cjs mysql|postgres');
  const postgres = dialect === 'postgres';
  const password = crypto.randomBytes(24).toString('hex');
  const seedPassword = crypto.randomBytes(24).toString('hex');
  const dbPort = postgres ? 5432 : 3306;
  const container = await new GenericContainer(images[dialect])
    .withEnvironment(postgres
      ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_ci_runtime' }
      : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_ci_runtime' })
    .withExposedPorts(dbPort)
    .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
    .withStartupTimeout(180000)
    .start();
  let app;
  let appLog = '';
  try {
    const input = {
      CI: 'true', DB_CORE_TEST_PROFILE: 'true',
      DB_DIALECT: dialect, DB_HOST: container.getHost(), DB_PORT: String(container.getMappedPort(dbPort)),
      DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password, DB_NAME: 'krasterisk_ci_runtime',
      DB_CONNECT_TIMEOUT_MS: '60000', DB_POOL_ACQUIRE_MS: '90000',
      CI_SEED_PASSWORD: seedPassword,
    };
    const config = resolveDatabaseConfig(input, { requireExplicitConnection: true });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        const db = await connectAdapter(config);
        await db.close();
        ready = true;
        break;
      } catch (error) {
        if (!['PROTOCOL_CONNECTION_LOST', 'ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', '57P03'].includes(error.code)) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    if (!ready) throw new Error(`${dialect} disposable database did not become ready`);
    await runMigrations({ config, migrations: loadMigrations(dialect) });
    console.log(`${dialect}: migrations ready`);
    await seed(input);
    console.log(`${dialect}: core seed ready`);
    await installCdr(input);
    console.log(`${dialect}: CDR fixture ready`);
    const port = await freePort();
    input.BACKEND_PORT = String(port);
    input.CORE_API_URL = `http://127.0.0.1:${port}/api`;
    const backend = path.resolve(__dirname, '../../packages/backend');
    app = spawn(process.execPath, [path.join(backend, 'dist/main.js')], {
      cwd: backend,
      env: { ...process.env, ...input, JWT_SECRET: crypto.randomBytes(48).toString('hex'),
        CC_AI_KEY_SECRET: crypto.randomBytes(48).toString('hex'), NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const collect = chunk => { appLog = (appLog + chunk.toString()).slice(-12000); };
    app.stdout.on('data', collect);
    app.stderr.on('data', collect);
    let listening = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (app.exitCode !== null) throw new Error(`AppModule exited before listening: ${appLog.slice(-8000)}`);
      try {
        const response = await fetch(`${input.CORE_API_URL}/docs`, { signal: AbortSignal.timeout(1500) });
        if (response.ok) { listening = true; break; }
      } catch { /* bounded retry */ }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!listening) throw new Error(`AppModule startup timeout: ${appLog.slice(-8000)}`);
    console.log(`${dialect}: AppModule listening`);
    const core = await coreSmoke(input);
    console.log(`${dialect}: core HTTP pass`);
    const cdr = await cdrSmoke(input);
    console.log(`${dialect}: CDR HTTP pass`);
    const callcenter = await callcenterGolden(input);
    console.log(`${dialect}: call-center golden pass`);
    const voiceRobots = await voiceRobotGolden(input);
    console.log(`${dialect}: scripted-robot golden pass`);
    return { dialect, schemaVersion: loadMigrations(dialect).at(-1).id, core, cdr, callcenter, voiceRobots };
  } finally {
    if (app && app.exitCode === null) {
      app.kill('SIGTERM');
      await Promise.race([once(app, 'exit'), new Promise(resolve => setTimeout(resolve, 5000))]);
      if (app.exitCode === null) app.kill('SIGKILL');
    }
    await container.stop();
  }
}

if (require.main === module) {
  main(process.argv[2]).then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
module.exports = { main };
