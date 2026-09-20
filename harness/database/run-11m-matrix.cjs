'use strict';
// Disposable AI-11 11M release matrix. Aggregate evidence + profile installs.
// Named pending gates. No productRuntime flip. No silent mock pass.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { cleanInstall, CURRENT_SCHEMA } = require('./clean-install.cjs');
const {
  ENGINES, aggregateMatrix, assertNoSilentMock, PENDING_GATES,
} = require('./release-matrix.cjs');
const images = require('./images.json');

const args = process.argv.slice(2);
const selected = args.filter((value) => ['mysql', 'postgres'].includes(value));
if (args.some((value) => !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-11m-matrix.cjs [mysql|postgres]');
}

for (const dialect of selected.length ? [...new Set(selected)] : [...ENGINES]) {
  test(`${dialect}: 11M release matrix profile installs (${images[dialect]})`, { timeout: 720000 }, async (t) => {
    const postgres = dialect === 'postgres';
    const password = crypto.randomBytes(24).toString('hex');
    const port = postgres ? 5432 : 3306;
    let container;
    try {
      container = await new GenericContainer(images[dialect])
        .withEnvironment(postgres
          ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_11m_admin' }
          : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_11m_admin' })
        .withExposedPorts(port)
        .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
        .withStartupTimeout(180000)
        .start();
    } catch {
      throw new Error('11M environment unavailable: Docker/image startup failed. Acceptance is NOT skipped or passed.');
    }
    let admin;
    t.after(async () => {
      try { if (admin) await admin.close(); } finally { await container.stop(); }
    });
    const environment = {
      DB_DIALECT: dialect,
      DB_HOST: container.getHost(),
      DB_PORT: String(container.getMappedPort(port)),
      DB_USER: postgres ? 'postgres' : 'root',
      DB_PASSWORD: password,
      DB_NAME: 'krasterisk_11m_admin',
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

    const installs = [];
    let sequence = 0;
    for (const profile of ['analytics-api', 'robot-api']) {
      // eslint-disable-next-line no-await-in-loop
      await t.test(`install ${profile} to ${CURRENT_SCHEMA}`, async () => {
        const name = `krasterisk_ci_${dialect}${++sequence}`;
        await admin.query(postgres ? `CREATE DATABASE "${name}"` : `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
        const input = {
          ...environment,
          DB_NAME: name,
          DB_SCHEMA_PROFILE: profile,
          CI: 'true',
          CI_SEED_PASSWORD: 'disposable-11m-password',
        };
        const installed = await cleanInstall(['--apply', '--seed-ci'], input);
        assert.equal(installed.readiness.schemaVersion, CURRENT_SCHEMA);
        installs.push({
          dialect, profile, schemaVersion: CURRENT_SCHEMA, ok: true,
        });
      });
    }

    const matrix = aggregateMatrix(installs);
    assertNoSilentMock(matrix);
    assert.equal(matrix.pendingGates.length, PENDING_GATES.length);
    for (const profile of matrix.profiles) {
      if (profile.evidence) {
        assert.equal(profile.evidencePresent, true, `missing evidence for ${profile.id} ${profile.evidence}`);
      }
    }
    const outDir = process.env.AI11_11M_OUT
      || path.join(__dirname, '../../.planning/initiatives/ai-products/evidence/11m');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `matrix-${dialect}.json`);
    fs.writeFileSync(outFile, `${JSON.stringify(matrix, null, 2)}\n`);
    t.diagnostic(`matrix=${outFile}`);
  });
}
