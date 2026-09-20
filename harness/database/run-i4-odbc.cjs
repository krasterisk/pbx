'use strict';
// Disposable I4 matrix. Fresh containers and generated credentials only.
// Never reads live /etc/asterisk or Adaptive ODBC DSN secrets.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { cleanInstall, CURRENT_SCHEMA } = require('./clean-install.cjs');
const { writeCdr, writeQueueLog, writeCel, isUniqueViolation } = require('../../packages/backend/src/modules/asterisk-odbc/asterisk-odbc-writer.cjs');
const { generateOdbcInstall, assertNotLivePath, ANALYTICS_ONLY_INDEPENDENT } = require('./odbc-installer.cjs');
const images = require('./images.json');

const args = process.argv.slice(2);
const selected = args.filter((value) => ['mysql', 'postgres'].includes(value));
if (args.some((value) => !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-i4-odbc.cjs [mysql|postgres]');
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function interpolate(sql, params, dialect) {
  if (dialect === 'postgres') {
    return sql.replace(/\$(\d+)/g, (_, index) => {
      const value = params[Number(index) - 1];
      return value == null ? 'NULL' : (typeof value === 'number' ? String(value) : sqlString(value));
    });
  }
  let cursor = 0;
  return sql.replace(/\?/g, () => {
    const value = params[cursor++];
    return value == null ? 'NULL' : (typeof value === 'number' ? String(value) : sqlString(value));
  });
}

async function createAsteriskRole(admin, { dialect, database, user, password }) {
  const postgres = dialect === 'postgres';
  if (postgres) {
    await admin.query(`CREATE ROLE ${user} LOGIN PASSWORD '${password.replace(/'/g, "''")}'`);
    await admin.query(`GRANT CONNECT ON DATABASE "${database}" TO ${user}`);
    return;
  }
  await admin.query(`CREATE USER '${user}'@'%' IDENTIFIED BY '${password.replace(/'/g, "''")}'`);
}

async function grantWriter(adapter, { dialect, user }) {
  const postgres = dialect === 'postgres';
  if (postgres) {
    await adapter.query(`GRANT USAGE ON SCHEMA public TO ${user}`);
    await adapter.query(`GRANT SELECT, INSERT, UPDATE ON cdr, queue_log, cel TO ${user}`);
    await adapter.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${user}`);
    return;
  }
  await adapter.query(`GRANT SELECT, INSERT, UPDATE ON cdr TO '${user}'@'%'`);
  await adapter.query(`GRANT SELECT, INSERT, UPDATE ON queue_log TO '${user}'@'%'`);
  await adapter.query(`GRANT SELECT, INSERT, UPDATE ON cel TO '${user}'@'%'`);
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  test(`${dialect}: I4 ODBC installer matrix (${images[dialect]})`, { timeout: 720000 }, async (t) => {
    const postgres = dialect === 'postgres';
    const password = crypto.randomBytes(24).toString('hex');
    const asteriskPassword = crypto.randomBytes(24).toString('hex');
    const port = postgres ? 5432 : 3306;
    let container;
    try {
      container = await new GenericContainer(images[dialect])
        .withEnvironment(postgres
          ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_i4_admin' }
          : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_i4_admin' })
        .withExposedPorts(port)
        .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
        .withStartupTimeout(180000)
        .start();
    } catch {
      throw new Error(`I4 ODBC environment unavailable: Docker/image startup failed. Acceptance is NOT skipped or passed.`);
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
      DB_NAME: 'krasterisk_i4_admin',
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

    await t.test('full-pbx generate + Asterisk user writer matches golden CDR/queue_log', async () => {
      const dbName = `krasterisk_ci_${dialect}1`;
      const asteriskUser = 'asterisk_i4';
      await admin.query(postgres ? `CREATE DATABASE "${dbName}"` : `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4`);
      const appEnv = {
        ...environment,
        DB_NAME: dbName,
        DB_SCHEMA_PROFILE: 'full-pbx',
        CI: 'true',
        CI_SEED_PASSWORD: 'disposable-i4-password',
      };
      const installed = await cleanInstall(['--apply'], appEnv);
      assert.equal(installed.readiness.schemaVersion, CURRENT_SCHEMA);
      await createAsteriskRole(admin, {
        dialect, database: dbName, user: asteriskUser, password: asteriskPassword,
      });
      const appConfig = resolveDatabaseConfig(appEnv, { requireExplicitConnection: true });
      const app = await connectAdapter(appConfig);
      try {
        await grantWriter(app, { dialect, user: asteriskUser });
      } finally {
        await app.close();
      }
      const out = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-i4-odbc-'));
      const generated = generateOdbcInstall(out, {
        dialect,
        host: environment.DB_HOST,
        port: Number(environment.DB_PORT),
        database: dbName,
        appUser: environment.DB_USER,
        asteriskUser,
        asteriskPassword,
        tls: false,
        cel: true,
      });
      assert.equal(generated.manifest.analyticsOnlyIndependent, ANALYTICS_ONLY_INDEPENDENT);
      assert.notEqual(generated.manifest.asteriskUser, generated.manifest.appUser);
      assert.throws(() => assertNotLivePath('/etc/asterisk/res_odbc.conf'), /live Asterisk\/ODBC/);

      const odbcEnv = {
        ...appEnv,
        DB_USER: asteriskUser,
        DB_PASSWORD: asteriskPassword,
      };
      const odbcConfig = resolveDatabaseConfig(odbcEnv, { requireExplicitConnection: true });
      const odbc = await connectAdapter(odbcConfig);
      try {
        const exec = async (sql, params) => {
          try {
            await odbc.query(interpolate(sql, params, dialect));
          } catch (error) {
            if (isUniqueViolation(error)) throw error;
            const wrapped = new Error(error instanceof Error ? error.message : String(error));
            if (error && typeof error === 'object' && 'code' in error) wrapped.code = error.code;
            throw wrapped;
          }
        };
        const cdr = {
          uniqueid: '1760000000.41', linkedid: '1760000000.41', calldate: '2026-09-20 11:00:00',
          src: '100', dst: 's', dcontext: 'krasterisk-ai-generated', disposition: 'ANSWERED',
          record: '8/calls/20260920/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', vpbx_user_uid: 8,
          clid: '"lab" <100>', channel: 'Local/s@krasterisk-ai-generated-0001;2',
        };
        assert.equal(await writeCdr(exec, dialect, cdr), 'inserted');
        assert.equal(await writeCdr(exec, dialect, cdr), 'replayed');
        const ql = {
          time: '2026-09-20 11:00:01', callid: '1760000000.41', queuename: 'sales',
          agent: 'NONE', event: 'ENTERQUEUE', data1: '100',
        };
        assert.equal(await writeQueueLog(exec, dialect, ql), 'inserted');
        assert.equal(await writeQueueLog(exec, dialect, ql), 'replayed');
        const cel = {
          eventtype: 'CHAN_START', eventtime: '2026-09-20 11:00:00', uniqueid: '1760000000.41',
          linkedid: '1760000000.41', channame: 'Local/s@krasterisk-ai-generated-0001;2',
          context: 'krasterisk-ai-generated',
        };
        assert.equal(await writeCel(exec, dialect, cel), 'inserted');
        assert.equal(await writeCel(exec, dialect, cel), 'replayed');
      } finally {
        await odbc.close();
      }
      const verify = await connectAdapter(appConfig);
      try {
        const cdrRows = await verify.query("SELECT uniqueid, record FROM cdr WHERE uniqueid='1760000000.41'");
        assert.equal(cdrRows.length, 1);
        assert.equal(cdrRows[0].record, '8/calls/20260920/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
        const qlRows = await verify.query("SELECT callid, event FROM queue_log WHERE callid='1760000000.41'");
        assert.equal(qlRows.length, 1);
        const celRows = await verify.query("SELECT uniqueid, eventtype FROM cel WHERE uniqueid='1760000000.41'");
        assert.equal(celRows.length, 1);
      } finally {
        await verify.close();
      }
    });
  });
}
