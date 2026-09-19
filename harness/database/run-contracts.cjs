'use strict';
// Uses only freshly created containers and generated credentials. Never reads DB_*.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { GenericContainer, Wait } = require('testcontainers');
const { Sequelize, DataTypes } = require('sequelize');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter, JOURNAL, STATE } = require('../../packages/backend/database/migration-adapter.cjs');
const { runMigrations, loadMigrations, checksum } = require('../../packages/backend/database/migration-runner.cjs');
const { seed } = require('../../packages/backend/database/seed-ci.cjs');
const { checkSchemaReadiness } = require('../../packages/backend/src/database/schema-readiness.cjs');
const images = require('./images.json');

const args = process.argv.slice(2);
const binOptions = args.filter(value => value.startsWith('--postgres-bin='));
const postgresBin = binOptions[0]?.slice('--postgres-bin='.length);
const selected = args.filter(value => !value.startsWith('--postgres-bin='));
if (binOptions.length > 1 || selected.some(value => !['mysql', 'postgres'].includes(value)) || (binOptions.length && (selected.length !== 1 || selected[0] !== 'postgres' || !postgresBin))) throw new Error('Usage: node harness/database/run-contracts.cjs [mysql|postgres]; optional --postgres-bin=absolute/path with postgres only');
const fixture = (id, sql) => ({ id, sql, checksum: checksum(sql) });

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  const profile = postgresBin ? 'isolated local PostgreSQL (supplemental smoke)' : images[dialect];
  test(`${dialect}: real database contracts (${profile})`, { timeout: 300000 }, async t => {
    const postgres = dialect === 'postgres';
    const password = crypto.randomBytes(24).toString('hex');
    const port = postgres ? 5432 : 3306;
    let container;
    try {
      container = postgresBin
        ? await require('./local-postgres.cjs').startLocalPostgres(postgresBin, password)
        : await new GenericContainer(images[dialect])
        .withEnvironment(postgres
          ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_db01_admin' }
          : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_db01_admin' })
        .withExposedPorts(port)
        .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
        .withStartupTimeout(180000)
        .start();
    } catch {
      throw new Error(`DB contract environment unavailable: ${postgresBin ? 'isolated local PostgreSQL' : 'Docker/image'} startup failed. Acceptance is NOT skipped or passed. Check the selected runtime.`);
    }
    let admin;
    t.after(async () => {
      try { if (admin) await admin.close(); } finally { await container.stop(); }
    });
    const environment = {
      DB_DIALECT: dialect, DB_HOST: container.getHost(), DB_PORT: String(container.getMappedPort(port)),
      DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password, DB_NAME: 'krasterisk_db01_admin',
    };
    const adminConfig = resolveDatabaseConfig(environment, { requireExplicitConnection: true });
    const readyDeadline = performance.now() + 60000;
    let readyAttempts = 0;
    for (;;) {
      readyAttempts++;
      try {
        admin = await connectAdapter(adminConfig);
        break;
      } catch (error) {
        if (performance.now() >= readyDeadline || !['PROTOCOL_CONNECTION_LOST', 'ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', '57P03'].includes(error.code)) {
          throw new Error(`Fresh ${dialect} server did not become ready (${error.code || 'UNKNOWN'})`);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    t.diagnostic(`Fresh database ready after ${readyAttempts} connection attempt(s)`);
    const versions = await admin.query('SELECT version() AS version');
    t.diagnostic(JSON.stringify({ profile, server: versions[0].version, node: process.version,
      sequelize: require('sequelize/package.json').version, driver: require(`${postgres ? 'pg' : 'mysql2'}/package.json`).version,
      pgHstore: require('pg-hstore/package.json').version }));
    let sequence = 0;
    const fresh = async () => {
      const name = `krasterisk_db01_case_${++sequence}`;
      assert.match(name, /^krasterisk_db01_case_\d+$/);
      await admin.query(postgres ? `CREATE DATABASE "${name}"` : `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
      return resolveDatabaseConfig({ ...environment, DB_NAME: name }, { requireExplicitConnection: true });
    };
    const withConnection = async (config, fn) => {
      const adapter = await connectAdapter(config);
      try { return await fn(adapter); } finally { await adapter.close(); }
    };
    for (const standaloneProfile of ['analytics-api', 'robot-api']) {
    await t.test(`${standaloneProfile} installs neutral tables only and binds schema identity`, async () => {
      const config = await fresh();
      const migrations = loadMigrations(dialect, standaloneProfile);
      const input = { ...environment, DB_NAME: config.database, DB_SCHEMA_PROFILE: standaloneProfile };
      const first = await runMigrations({ config, migrations, profile: standaloneProfile });
      assert.equal(first.profile, standaloneProfile);
      assert.equal(first.pending.length, 0);
      assert.equal((await checkSchemaReadiness(input)).schemaVersion, '0014-sa-metrics.sql');
      await withConnection(config, async db => {
        const tables = await db.tables();
        for (const required of ['users', 'tenants', 'user_sessions', 'cc_ai_providers',
          'ai_product_activation', 'ai_integration_principals', 'ai_jobs',
          'ai_quota_counters', 'ai_usage_ledger', 'ai_capture_intents', 'sa_projects',
          'ai_webhook_endpoints', 'ai_robot_drafts', 'sa_metric_definitions', JOURNAL, STATE]) {
          assert.ok(tables.includes(required), `${required} missing from minimal profile`);
        }
        for (const excluded of ['contexts', 'cdr', 'queue_log', 'ps_endpoints', 'ac_campaigns']) {
          assert.ok(!tables.includes(excluded), `${excluded} leaked into minimal profile`);
        }
        const [state] = await db.readState();
        assert.equal(state.profile, standaloneProfile);
      });
      const replay = await runMigrations({ config, migrations, profile: standaloneProfile });
      assert.deepEqual(replay.newlyApplied, []);
      await assert.rejects(runMigrations({ config, migrations: loadMigrations(dialect),
        profile: 'full-pbx', mode: 'status' }), /profile mismatch/);
    });
    }
    await t.test('canonical schema readiness and disposable core seed', async () => {
      const name = `krasterisk_ci_${dialect}`;
      await admin.query(postgres ? `CREATE DATABASE "${name}"` : `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
      const input = { ...environment, DB_NAME: name, CI: 'true', CI_SEED_PASSWORD: 'disposable-test-password-only' };
      const config = resolveDatabaseConfig(input, { requireExplicitConnection: true });
      await assert.rejects(checkSchemaReadiness(input), /expected|unversioned/);
      await runMigrations({ config, migrations: loadMigrations(dialect) });
      assert.equal((await checkSchemaReadiness(input)).engine, dialect);
      const result = await seed(input);
      assert.equal(result.tenantIds.length, 2);
      await assert.rejects(seed(input), /Refusing to overwrite/);
      await withConnection(config, async db => {
        const users = await db.query('SELECT uniqueid, vpbx_user_uid, role FROM users ORDER BY uniqueid');
        assert.equal(users.length, 3);
        assert.equal(Number(users[0].vpbx_user_uid), 0);
        assert.equal(Number(users[1].vpbx_user_uid), Number(users[1].uniqueid));
        assert.equal(Number(users[2].vpbx_user_uid), Number(users[2].uniqueid));
        assert.ok(users.every(user => Number(user.role) > 0));
        const loginRace = await Promise.allSettled([
          withConnection(config, session => session.query(`UPDATE users SET login='B4-Login-Race' WHERE uniqueid=${Number(users[1].uniqueid)}`)),
          withConnection(config, session => session.query(`UPDATE users SET login='b4-login-race' WHERE uniqueid=${Number(users[2].uniqueid)}`)),
        ]);
        assert.deepEqual(loginRace.map(result => result.status).sort(), ['fulfilled', 'rejected']);
        assert.equal((await db.query('SELECT * FROM tenants')).length, 2);
        assert.equal((await db.query('SELECT * FROM cc_ai_providers')).length, 2);
        // A2 tables are additive to the baseline on both engines. Verify
        // tenant zero, binary columns, composite activation and binding FK.
        await db.query(`INSERT INTO ai_local_license_documents
          (uid, license_id, revision, vpbx_user_uid, installation_id,
           payload_bytes, signature_bytes, digest_sha256, imported_at,
           imported_by, max_observed_at)
          VALUES ('a2-document', '00000000-0000-4000-8000-000000000001', 1,
            0, 'test-installation', 'payload', 'signature', 'digest',
            '2026-09-18 12:00:00.000', 1, '2026-09-18 12:00:00.000')`);
        await db.query(`INSERT INTO ai_local_license_bindings
          (vpbx_user_uid, product, document_uid, revision, actor_user_id, updated_at)
          VALUES (0, 'speech_analytics', 'a2-document', 1, 1, '2026-09-18 12:00:00.000')`);
        await db.query(`INSERT INTO ai_product_activation
          (vpbx_user_uid, product, enabled, revision, actor_user_id, updated_at)
          VALUES (0, 'speech_analytics', TRUE, 1, 1, '2026-09-18 12:00:00.000')`);
        const [bound] = await db.query(`SELECT a.enabled, b.document_uid, d.revision
          FROM ai_product_activation a
          JOIN ai_local_license_bindings b ON b.vpbx_user_uid=a.vpbx_user_uid AND b.product=a.product
          JOIN ai_local_license_documents d ON d.uid=b.document_uid
          WHERE a.vpbx_user_uid=0 AND a.product='speech_analytics'`);
        assert.equal(Boolean(bound.enabled), true);
        assert.equal(bound.document_uid, 'a2-document');
        assert.equal(Number(bound.revision), 1);
        await assert.rejects(db.query(`INSERT INTO ai_local_license_bindings
          (vpbx_user_uid, product, document_uid, revision, actor_user_id, updated_at)
          VALUES (0, 'ai_voice_robots', 'missing-document', 1, 1, '2026-09-18 12:00:00.000')`));
        await db.query(`INSERT INTO ai_integration_principals
          (id, vpbx_user_uid, label, product, status, permission_revision,
           created_by, created_at, updated_at)
          VALUES ('00000000-0000-4000-8000-000000000002', 0, 'fixture',
            'speech_analytics', 'active', 1, 1,
            '2026-09-18 12:00:00.000', '2026-09-18 12:00:00.000')`);
        await db.query(`INSERT INTO ai_integration_credentials
          (id, vpbx_user_uid, principal_id, selector, secret_digest,
           generation, created_at, created_by)
          VALUES ('00000000-0000-4000-8000-000000000003', 0,
            '00000000-0000-4000-8000-000000000002', 'AAAAAAAAAAAAAAAAAAAAAA',
            '01234567890123456789012345678901', 1, '2026-09-18 12:00:00.000', 1)`);
        await db.query(`INSERT INTO ai_integration_grants
          (id, vpbx_user_uid, principal_id, resource_kind, resource_id, scope, created_at)
          VALUES ('00000000-0000-4000-8000-000000000004', 0,
            '00000000-0000-4000-8000-000000000002', 'project',
            '00000000-0000-4000-8000-000000000005', 'analytics:read', '2026-09-18 12:00:00.000')`);
        await db.query(`INSERT INTO ai_integration_audit
          (id, vpbx_user_uid, principal_id, actor_user_id, action,
           request_id, metadata, created_at)
          VALUES ('00000000-0000-4000-8000-000000000006', 0,
            '00000000-0000-4000-8000-000000000002', 1, 'create',
            '00000000-0000-4000-8000-000000000007', '{}', '2026-09-18 12:00:00.000')`);
        await db.query(`INSERT INTO ai_integration_commands
          (vpbx_user_uid, actor_user_id, operation_id, command_hash,
           principal_id, resulting_generation, completed_at)
          VALUES (0, 1, '00000000-0000-4000-8000-000000000008',
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            '00000000-0000-4000-8000-000000000002', 1, '2026-09-18 12:00:00.000')`);
        const [machine] = await db.query(`SELECT p.vpbx_user_uid, c.generation,
          (SELECT COUNT(*) FROM ai_integration_grants g WHERE g.principal_id=p.id) AS grants
          FROM ai_integration_principals p JOIN ai_integration_credentials c
            ON c.vpbx_user_uid=p.vpbx_user_uid AND c.principal_id=p.id
          WHERE p.id='00000000-0000-4000-8000-000000000002'`);
        assert.equal(Number(machine.vpbx_user_uid), 0);
        assert.equal(Number(machine.generation), 1);
        assert.equal(Number(machine.grants), 1);
        await assert.rejects(db.query(`INSERT INTO ai_integration_credentials
          (id, vpbx_user_uid, principal_id, selector, secret_digest,
           generation, created_at, created_by)
          VALUES ('00000000-0000-4000-8000-000000000009', 42,
            '00000000-0000-4000-8000-000000000002', 'BBBBBBBBBBBBBBBBBBBBBB',
            '01234567890123456789012345678901', 2, '2026-09-18 12:00:00.000', 1)`));
        const rotateAttempt = (id, selector) => withConnection(config, session => session.query(`INSERT INTO ai_integration_credentials
          (id, vpbx_user_uid, principal_id, selector, secret_digest,
           predecessor_id, generation, created_at, created_by)
          VALUES ('${id}', 0, '00000000-0000-4000-8000-000000000002',
            '${selector}', '01234567890123456789012345678901',
            '00000000-0000-4000-8000-000000000003', 2,
            '2026-09-18 12:01:00.000', 1)`));
        const generationRace = await Promise.allSettled([
          rotateAttempt('00000000-0000-4000-8000-000000000010', 'CCCCCCCCCCCCCCCCCCCCCC'),
          rotateAttempt('00000000-0000-4000-8000-000000000011', 'DDDDDDDDDDDDDDDDDDDDDD'),
        ]);
        assert.deepEqual(generationRace.map(result => result.status).sort(), ['fulfilled', 'rejected']);
        const commandRace = await Promise.allSettled([1, 2].map(index => withConnection(config, session => session.query(`INSERT INTO ai_integration_commands
          (vpbx_user_uid, actor_user_id, operation_id, command_hash,
           principal_id, resulting_generation, completed_at)
          VALUES (0, 1, '00000000-0000-4000-8000-000000000012',
            '${'a'.repeat(63)}${index}', '00000000-0000-4000-8000-000000000002',
            2, '2026-09-18 12:01:00.000')`))));
        assert.deepEqual(commandRace.map(result => result.status).sort(), ['fulfilled', 'rejected']);
        await db.query(`INSERT INTO ai_integration_auth_limits (key_hash, attempts, expires_at)
          VALUES ('${'e'.repeat(64)}', 1, '2026-09-18 12:01:00.000')`);
        const [limit] = await db.query(`SELECT attempts FROM ai_integration_auth_limits
          WHERE key_hash='${'e'.repeat(64)}'`);
        assert.equal(Number(limit.attempts), 1);
        const upsertLimit = (now, expires) => withConnection(config, session => session.query(postgres
          ? `INSERT INTO ai_integration_auth_limits (key_hash, attempts, expires_at)
              VALUES ('${'f'.repeat(64)}', 1, '${expires}')
              ON CONFLICT (key_hash) DO UPDATE SET
                attempts = CASE WHEN ai_integration_auth_limits.expires_at <= '${now}'
                  THEN 1 ELSE ai_integration_auth_limits.attempts + 1 END,
                expires_at = CASE WHEN ai_integration_auth_limits.expires_at <= '${now}'
                  THEN '${expires}' ELSE ai_integration_auth_limits.expires_at END`
          : `INSERT INTO ai_integration_auth_limits (key_hash, attempts, expires_at)
              VALUES ('${'f'.repeat(64)}', 1, '${expires}')
              ON DUPLICATE KEY UPDATE
                attempts = IF(expires_at <= '${now}', 1, attempts + 1),
                expires_at = IF(expires_at <= '${now}', '${expires}', expires_at)`));
        await Promise.all([1, 2].map(() => upsertLimit('2026-09-18 12:00:00.000', '2026-09-18 12:01:00.000')));
        const [counted] = await db.query(`SELECT attempts FROM ai_integration_auth_limits WHERE key_hash='${'f'.repeat(64)}'`);
        assert.equal(Number(counted.attempts), 2);
        await upsertLimit('2026-09-18 12:02:00.000', '2026-09-18 12:03:00.000');
        const [reset] = await db.query(`SELECT attempts FROM ai_integration_auth_limits WHERE key_hash='${'f'.repeat(64)}'`);
        assert.equal(Number(reset.attempts), 1);
      });
    });
    const migrations = [fixture('0001-fixture.sql', `CREATE TABLE contract_item (id INTEGER PRIMARY KEY, tenant INTEGER NOT NULL, label VARCHAR(80) NOT NULL, amount DECIMAL(18,4) NOT NULL, payload ${postgres ? 'JSONB' : 'JSON'});
      INSERT INTO contract_item (id, tenant, label, amount, payload) VALUES (1, 0, 'Звонок', 123.4500, '{"ready":true}');`)];

    await t.test('status is read-only; first apply and replay preserve journal', async () => {
      const config = await fresh();
      const before = await runMigrations({ config, migrations, mode: 'status' });
      assert.equal(before.historyState, 'empty');
      assert.deepEqual(await withConnection(config, db => db.tables()), []);
      assert.deepEqual((await runMigrations({ config, migrations })).newlyApplied, ['0001-fixture.sql']);
      const journal = await withConnection(config, db => db.query(`SELECT * FROM ${JOURNAL}`));
      assert.deepEqual((await runMigrations({ config, migrations })).newlyApplied, []);
      assert.deepEqual(await withConnection(config, db => db.query(`SELECT * FROM ${JOURNAL}`)), journal);
      await withConnection(config, db => db.query(`ALTER TABLE ${STATE} DROP COLUMN profile`));
      assert.equal((await runMigrations({ config, migrations, mode: 'status' })).profileState,
        'legacy-full-pbx');
      assert.deepEqual((await runMigrations({ config, migrations })).newlyApplied, []);
      assert.equal((await withConnection(config, db => db.readState()))[0].profile, 'full-pbx');
      assert.deepEqual(await withConnection(config, db => db.query(`SELECT * FROM ${JOURNAL}`)), journal);
      const item = (await withConnection(config, db => db.query('SELECT * FROM contract_item')))[0];
      assert.equal(item.label, 'Звонок');
      assert.equal(item.amount, '123.4500');
      assert.equal(item.tenant, 0);
      assert.equal((typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload).ready, true);
    });

    await t.test('Sequelize uses the same config and persists tenant/Unicode/JSON', async () => {
      const config = await fresh();
      await runMigrations({ config, migrations });
      const sequelize = new Sequelize({ ...config, logging: false });
      try {
        const Item = sequelize.define('contract_item', {
          id: { type: DataTypes.INTEGER, primaryKey: true }, tenant: DataTypes.INTEGER,
          label: DataTypes.STRING(80), amount: DataTypes.DECIMAL(18, 4), payload: DataTypes.JSON,
        }, { timestamps: false, freezeTableName: true });
        await Item.create({ id: 2, tenant: 7, label: 'Клиент', amount: '900.1200', payload: { source: 'SIP' } });
        const value = (await Item.findByPk(2)).get({ plain: true });
        assert.equal(value.label, 'Клиент');
        assert.equal(value.tenant, 7);
        assert.deepEqual(value.payload, { source: 'SIP' });
      } finally { await sequelize.close(); }
    });

    await t.test('changed checksum, wrong engine and unversioned schemas fail closed', async () => {
      const config = await fresh();
      await runMigrations({ config, migrations });
      await assert.rejects(runMigrations({ config, migrations: [fixture('0001-fixture.sql', migrations[0].sql + '\n-- changed')] }), /Applied migration changed/);
      await withConnection(config, db => db.query(`UPDATE ${STATE} SET engine = '${postgres ? 'mysql' : 'postgres'}'`));
      await assert.rejects(runMigrations({ config, migrations }), /engine identity mismatch/);
      const legacy = await fresh();
      await withConnection(legacy, db => db.query('CREATE TABLE existing_user_data (id INTEGER)'));
      await assert.rejects(runMigrations({ config: legacy, migrations }), /Existing unversioned schema/);
    });

    await t.test('concurrent runners serialize; second run is a no-op', async () => {
      const config = await fresh();
      const slow = [fixture('0001-slow.sql', `${postgres ? 'SELECT pg_sleep(0.3)' : 'DO SLEEP(0.3)'}; CREATE TABLE concurrent_fixture (id INTEGER PRIMARY KEY);`)];
      const results = await Promise.all([runMigrations({ config, migrations: slow }), runMigrations({ config, migrations: slow })]);
      assert.equal(results.reduce((total, result) => total + result.newlyApplied.length, 0), 1);
      assert.equal((await withConnection(config, db => db.readJournal())).length, 1);
    });

    await t.test('lock timeout is bounded; disconnect releases connection-owned lock', async () => {
      const config = await fresh();
      const owner = await connectAdapter(config);
      try {
        assert.equal(await owner.acquireLock(0), true);
        const started = performance.now();
        await assert.rejects(runMigrations({ config, migrations, lockTimeoutMs: 150 }), /lock unavailable/);
        assert.ok(performance.now() - started < 5000);
      } finally { await owner.close(); } // Deliberately no explicit unlock.
      assert.equal((await runMigrations({ config, migrations, lockTimeoutMs: 1000 })).dirty, null);
    });

    await t.test('mid-migration error leaves dirty marker, no success journal and blocks restart', async () => {
      const config = await fresh();
      const broken = [...migrations, fixture('0002-broken.sql', 'CREATE TABLE partial_fixture (id INTEGER); INSERT INTO table_that_does_not_exist VALUES (1);')];
      await assert.rejects(runMigrations({ config, migrations: broken }), /operation failed/);
      const status = await runMigrations({ config, migrations: broken, mode: 'status', lockTimeoutMs: 1000 });
      assert.deepEqual(status.applied, ['0001-fixture.sql']);
      assert.equal(status.dirty.name, '0002-broken.sql');
      assert.deepEqual(status.pending, ['0002-broken.sql']);
      const tables = await withConnection(config, db => db.tables());
      assert.equal(tables.includes('partial_fixture'), !postgres); // PG transactional DDL vs MySQL implicit commit.
      await assert.rejects(runMigrations({ config, migrations: broken }), /Interrupted\/failed/);
    });

    await t.test('legacy successful journal is adopted without rewriting applied rows', async () => {
      const config = await fresh();
      await runMigrations({ config, migrations });
      const before = await withConnection(config, async db => {
        const journal = await db.query(`SELECT * FROM ${JOURNAL}`);
        await db.query(`DROP TABLE ${STATE}`);
        return journal;
      });
      assert.equal((await runMigrations({ config, migrations, mode: 'status' })).historyState, 'legacy');
      assert.deepEqual((await runMigrations({ config, migrations })).newlyApplied, []);
      assert.deepEqual(await withConnection(config, db => db.query(`SELECT * FROM ${JOURNAL}`)), before);
    });

    if (!postgres) {
      await t.test('unchanged current MySQL application baseline installs and replays', async () => {
        const config = await fresh();
        const baseline = loadMigrations('mysql');
        assert.equal((await runMigrations({ config, migrations: baseline.slice(0, 1) })).schemaVersion, '0001-current-schema.sql');
        const tables = await withConnection(config, db => db.tables());
        for (const table of ['users', 'cdr', 'ps_endpoints']) assert.ok(tables.includes(table), `Missing ${table}`);
        await withConnection(config, db => db.query("INSERT INTO tenant_settings (vpbx_user_uid, `key`, value) VALUES (7, 'locale', 'ru-RU')"));
        assert.deepEqual((await runMigrations({ config, migrations: baseline })).newlyApplied, ['0002-cdr-query-indexes.sql', '0003-callcenter-report-keys.sql', '0004-ai-product-access.sql', '0005-ai-integration-credentials.sql', '0006-ai-integration-auth-limits.sql', '0007-tenant-login-uniqueness.sql', '0008-ai-jobs-assets.sql', '0009-ai-usage.sql', '0010-ai-capture.sql', '0011-speech-analytics.sql', '0012-ai-webhooks.sql', '0013-ai-voice.sql', '0014-sa-metrics.sql']);
        const indexes = await withConnection(config, db => db.query("SELECT index_name AS name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'cdr' AND index_name LIKE 'idx_cdr_tenant_%' GROUP BY index_name"));
        assert.equal(indexes.length, 2);
        assert.deepEqual((await runMigrations({ config, migrations: baseline })).newlyApplied, []);
        const preserved = await withConnection(config, db => db.query("SELECT vpbx_user_uid, value FROM tenant_settings WHERE `key` = 'locale'"));
        assert.equal(preserved.length, 1);
        assert.equal(preserved[0].vpbx_user_uid, 7);
        assert.equal(preserved[0].value, 'ru-RU');
        t.diagnostic(`MySQL baseline checksum: ${baseline[0].checksum}; tables: ${tables.length}`);
      });
    } else {
      await t.test('canonical PostgreSQL application baseline installs through migration runner and replays', async () => {
        const config = await fresh();
        const file = path.resolve(__dirname, '../../packages/backend/database/migrations/postgres/0001-current-schema.sql');
        const baseline = loadMigrations('postgres');
        assert.equal(baseline[0].sql, fs.readFileSync(file, 'utf8'));
        assert.equal((await runMigrations({ config, migrations: baseline.slice(0, 1) })).schemaVersion, '0001-current-schema.sql');
        await withConnection(config, db => db.query("INSERT INTO cdr (uniqueid, linkedid, calldate, vpbx_user_uid) VALUES ('pg-upgrade-fixture', 'pg-upgrade-fixture', '2026-09-18 10:00:00', 7)"));
        assert.deepEqual((await runMigrations({ config, migrations: baseline })).newlyApplied, ['0002-cdr-query-indexes.sql', '0003-callcenter-report-keys.sql', '0004-ai-product-access.sql', '0005-ai-integration-credentials.sql', '0006-ai-integration-auth-limits.sql', '0007-tenant-login-uniqueness.sql', '0008-ai-jobs-assets.sql', '0009-ai-usage.sql', '0010-ai-capture.sql', '0011-speech-analytics.sql', '0012-ai-webhooks.sql', '0013-ai-voice.sql', '0014-sa-metrics.sql']);
        const indexes = await withConnection(config, db => db.query("SELECT indexname AS name FROM pg_indexes WHERE schemaname='public' AND tablename='cdr' AND indexname LIKE 'idx_cdr_tenant_%'"));
        assert.equal(indexes.length, 2);
        assert.equal((await withConnection(config, db => db.query("SELECT COUNT(*)::int AS count FROM cdr WHERE uniqueid='pg-upgrade-fixture'")))[0].count, 1);
        const tables = await withConnection(config, db => db.tables());
        assert.equal(tables.length, 166); // 152 prior + 8 VR + 6 MET.
        const columns = await withConnection(config, db => db.query("SELECT COUNT(*)::int AS count FROM information_schema.columns WHERE table_schema='public'"));
        assert.equal(columns[0].count, 1784); // 1651 prior + 82 VR + 51 MET.
        const shape = await withConnection(config, db => db.query(`SELECT table_name, column_name, data_type, udt_name, is_nullable, numeric_precision, numeric_scale
          FROM information_schema.columns WHERE table_schema='public' AND
          (table_name, column_name) IN (('cc_ai_cdr','cost_total'),('webhook_failures','id'),('voice_robot_cdr','uid'),
            ('cc_ai_agents','mode'),('cc_ai_agents','enabled'),('ac_campaigns','pacing'),('ac_campaigns','created_at'),('cdr','calldate'))`));
        const byName = Object.fromEntries(shape.map(row => [`${row.table_name}.${row.column_name}`, row]));
        assert.equal(byName['cc_ai_cdr.cost_total'].data_type, 'numeric');
        assert.equal(byName['cc_ai_cdr.cost_total'].numeric_precision, 10);
        assert.equal(byName['cc_ai_cdr.cost_total'].numeric_scale, 4);
        assert.equal(byName['webhook_failures.id'].data_type, 'bigint');
        assert.equal(byName['voice_robot_cdr.uid'].data_type, 'bigint');
        assert.equal(byName['cc_ai_agents.mode'].udt_name, 'enum_cc_ai_agents_mode');
        assert.equal(byName['cc_ai_agents.enabled'].data_type, 'boolean');
        assert.equal(byName['ac_campaigns.pacing'].data_type, 'json');
        assert.equal(byName['ac_campaigns.created_at'].data_type, 'timestamp with time zone');
        assert.equal(byName['cdr.calldate'].data_type, 'character varying');
        const counts = await withConnection(config, db => db.query(`SELECT
          (SELECT COUNT(*)::int FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='e') AS enums,
          (SELECT COUNT(*)::int FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f') AS foreign_keys,
          (SELECT COUNT(*)::int FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%_fk') AS foreign_key_indexes`));
        assert.deepEqual(counts[0], { enums: 40, foreign_keys: 40, foreign_key_indexes: 9 });
        assert.deepEqual((await runMigrations({ config, migrations: baseline })).newlyApplied, []);
        t.diagnostic(`PostgreSQL baseline checksum: ${baseline[0].checksum}; tables: ${tables.length}`);
      });
    }

    await t.test('rollup unique-key preflight refuses legacy duplicates without dirtying history', async () => {
      const config = await fresh();
      const baseline = loadMigrations(dialect);
      await runMigrations({ config, migrations: baseline.slice(0, 2) });
      const duplicate = "INSERT INTO cc_daily_queue_stats (stat_date, queue_name, created_at, vpbx_user_uid) VALUES ('2026-09-18', 'db02-duplicate', CURRENT_TIMESTAMP, 2)";
      await withConnection(config, async db => { await db.query(duplicate); await db.query(duplicate); });
      await assert.rejects(runMigrations({ config, migrations: baseline }), /Duplicate cc_daily_queue_stats business keys/);
      const status = await runMigrations({ config, migrations: baseline, mode: 'status' });
      assert.equal(status.dirty, null);
      assert.deepEqual(status.pending, ['0003-callcenter-report-keys.sql', '0004-ai-product-access.sql', '0005-ai-integration-credentials.sql', '0006-ai-integration-auth-limits.sql', '0007-tenant-login-uniqueness.sql', '0008-ai-jobs-assets.sql', '0009-ai-usage.sql', '0010-ai-capture.sql', '0011-speech-analytics.sql', '0012-ai-webhooks.sql', '0013-ai-voice.sql', '0014-sa-metrics.sql']);
      await withConnection(config, db => db.query("DELETE FROM cc_daily_queue_stats WHERE queue_name = 'db02-duplicate' AND vpbx_user_uid = 2"));
      assert.deepEqual((await runMigrations({ config, migrations: baseline })).newlyApplied, ['0003-callcenter-report-keys.sql', '0004-ai-product-access.sql', '0005-ai-integration-credentials.sql', '0006-ai-integration-auth-limits.sql', '0007-tenant-login-uniqueness.sql', '0008-ai-jobs-assets.sql', '0009-ai-usage.sql', '0010-ai-capture.sql', '0011-speech-analytics.sql', '0012-ai-webhooks.sql', '0013-ai-voice.sql', '0014-sa-metrics.sql']);
    });

    await t.test('login uniqueness preflight refuses legacy duplicates without dirtying history', async () => {
      const config = await fresh();
      const baseline = loadMigrations(dialect);
      await runMigrations({ config, migrations: baseline.slice(0, baseline.findIndex(item => item.id === '0007-tenant-login-uniqueness.sql')) });
      const stamp = postgres ? '"createdAt", "updatedAt"' : '`createdAt`, `updatedAt`';
      await withConnection(config, async db => {
        for (const login of ['B4-Legacy', 'b4-legacy']) {
          await db.query(`INSERT INTO users (login, name, passwd, ${stamp})
            VALUES ('${login}', 'fixture', 'hash', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
        }
      });
      await assert.rejects(runMigrations({ config, migrations: baseline }), /Duplicate users login keys/);
      const status = await runMigrations({ config, migrations: baseline, mode: 'status' });
      assert.equal(status.dirty, null);
      assert.deepEqual(status.pending, ['0007-tenant-login-uniqueness.sql', '0008-ai-jobs-assets.sql', '0009-ai-usage.sql', '0010-ai-capture.sql', '0011-speech-analytics.sql', '0012-ai-webhooks.sql', '0013-ai-voice.sql', '0014-sa-metrics.sql']);
      await withConnection(config, db => db.query("DELETE FROM users WHERE name='fixture' AND LOWER(login)='b4-legacy'"));
      assert.deepEqual((await runMigrations({ config, migrations: baseline })).newlyApplied,
        ['0007-tenant-login-uniqueness.sql', '0008-ai-jobs-assets.sql', '0009-ai-usage.sql', '0010-ai-capture.sql', '0011-speech-analytics.sql', '0012-ai-webhooks.sql', '0013-ai-voice.sql', '0014-sa-metrics.sql']);
    });

    await t.test('D1 job/asset constraints reject illegal state, tenant FK mismatch, and unique collisions', async () => {
      const config = await fresh();
      await runMigrations({ config, migrations: loadMigrations(dialect) });
      const now = 'CURRENT_TIMESTAMP';
      const keyDigest = postgres ? `decode('${'11'.repeat(32)}','hex')` : `X'${'11'.repeat(32)}'`;
      const hash = `'${'ab'.repeat(32)}'`;
      await withConnection(config, async db => {
        await db.query(`INSERT INTO ai_provider_revisions
          (id, vpbx_user_uid, provider_uid, revision, configuration, capability_digest, credential_ref, key_version, created_at)
          VALUES ('rev-1', 1, 'prov-1', 1, '{}', ${hash}, 'cred-ref', 1, ${now})`);
        await assert.rejects(db.query(`INSERT INTO ai_provider_revisions
          (id, vpbx_user_uid, provider_uid, revision, configuration, capability_digest, credential_ref, key_version, created_at)
          VALUES ('rev-2', 1, 'prov-1', 1, '{}', ${hash}, 'cred-ref', 1, ${now})`));
        await db.query(`INSERT INTO ai_media_assets
          (id, vpbx_user_uid, source_kind, storage_key, state, bytes, media_metadata, version, created_at, updated_at)
          VALUES ('asset-1', 1, 'upload', 'tenant/1/asset-1', 'allocated', 0, '{}', 1, ${now}, ${now})`);
        await assert.rejects(db.query(`INSERT INTO ai_media_assets
          (id, vpbx_user_uid, source_kind, storage_key, state, bytes, media_metadata, version, created_at, updated_at)
          VALUES ('asset-2', 2, 'upload', 'tenant/1/asset-1', 'allocated', 0, '{}', 1, ${now}, ${now})`));
        await db.query(`INSERT INTO ai_idempotency
          (vpbx_user_uid, stable_principal_id, operation_namespace, key_digest, request_hash, state, safe_response, expires_at, created_at, updated_at)
          VALUES (1, 'prin-1', 'jobs.create', ${keyDigest}, ${hash}, 'started', '{}', ${now}, ${now}, ${now})`);
        await db.query(`INSERT INTO ai_jobs
          (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
          VALUES ('job-1', 1, 'speech_analytics', 'analyze', 'asset', 'asset-1', 'queued', 0, ${now}, 1, ${now}, ${now})`);
        await assert.rejects(db.query(`INSERT INTO ai_jobs
          (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
          VALUES ('job-bad', 1, 'speech_analytics', 'analyze', 'asset', 'asset-1', 'bogus', 0, ${now}, 1, ${now}, ${now})`));
        await assert.rejects(db.query(`INSERT INTO ai_job_stages
          (id, vpbx_user_uid, job_id, stage_key, state, attempt_count, fence, version, created_at, updated_at)
          VALUES ('stage-bad', 2, 'job-1', 'probe', 'pending', 0, 0, 1, ${now}, ${now})`));
        await db.query(`INSERT INTO ai_job_stages
          (id, vpbx_user_uid, job_id, stage_key, state, attempt_count, fence, version, created_at, updated_at)
          VALUES ('stage-1', 1, 'job-1', 'probe', 'pending', 0, 0, 1, ${now}, ${now})`);
        await db.query(`INSERT INTO ai_outbox
          (id, vpbx_user_uid, aggregate_kind, aggregate_id, aggregate_version, event_type, schema_version, payload, available_at, fence, attempts, version, created_at)
          VALUES ('out-1', 1, 'job', 'job-1', 1, 'admitted', 1, '{}', ${now}, 0, 0, 1, ${now})`);
        await assert.rejects(db.query(`INSERT INTO ai_outbox
          (id, vpbx_user_uid, aggregate_kind, aggregate_id, aggregate_version, event_type, schema_version, payload, available_at, fence, attempts, version, created_at)
          VALUES ('out-2', 1, 'job', 'job-1', 1, 'admitted', 1, '{}', ${now}, 0, 0, 1, ${now})`));
        await db.query(`INSERT INTO ai_jobs
          (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
          VALUES ('job-cas', 1, 'speech_analytics', 'analyze', 'asset', 'asset-1', 'queued', 0, ${now}, 1, ${now}, ${now})`);
        const casSql = postgres
          ? "UPDATE ai_jobs SET version = 2, state = 'running' WHERE id='job-cas' AND version = 1 RETURNING id"
          : "UPDATE ai_jobs SET version = 2, state = 'running' WHERE id='job-cas' AND version = 1";
        const casWon = result => (Array.isArray(result) ? result.length : Number(result.affectedRows)) === 1;
        const casRace = await Promise.all([
          withConnection(config, session => session.query(casSql)),
          withConnection(config, session => session.query(casSql)),
        ]);
        assert.equal(casRace.filter(casWon).length, 1);
        const uniqueRace = await Promise.allSettled([3, 4].map(tenant => withConnection(config, session => session.query(`INSERT INTO ai_media_assets
          (id, vpbx_user_uid, source_kind, storage_key, state, bytes, media_metadata, version, created_at, updated_at)
          VALUES ('asset-race-${tenant}', ${tenant}, 'upload', 'tenant/race-key', 'allocated', 0, '{}', 1, ${now}, ${now})`))));
        assert.deepEqual(uniqueRace.map(result => result.status).sort(), ['fulfilled', 'rejected']);
        if (postgres) {
          const indexes = await db.query("SELECT indexname AS name FROM pg_indexes WHERE schemaname='public' AND tablename IN ('ai_jobs','ai_media_assets','ai_outbox','ai_idempotency')");
          const names = indexes.map(row => row.name);
          for (const name of ['idx_ai_job_tenant_state_created', 'idx_ai_media_asset_state_retention', 'idx_ai_outbox_pending', 'idx_ai_idempotency_expires', 'uq_ai_media_asset_storage_key', 'uq_ai_outbox_event']) {
            assert.ok(names.includes(name), `missing ${name}`);
          }
          const [collation] = await db.query("SELECT datcollate AS db_collate FROM pg_database WHERE datname = current_database()");
          assert.ok(collation.db_collate);
        } else {
          const [table] = await db.query("SELECT TABLE_COLLATION AS table_collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_jobs'");
          assert.match(String(table.table_collation), /utf8mb4/);
          const indexes = await db.query("SELECT INDEX_NAME AS name, COLUMN_NAME AS col, SUB_PART AS prefix FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('ai_jobs','ai_media_assets','ai_outbox','ai_idempotency')");
          const names = [...new Set(indexes.map(row => row.name))];
          for (const name of ['idx_ai_job_tenant_state_created', 'idx_ai_media_asset_state_retention', 'idx_ai_outbox_pending', 'idx_ai_idempotency_expires', 'uq_ai_media_asset_storage_key', 'uq_ai_outbox_event']) {
            assert.ok(names.includes(name), `missing ${name}`);
          }
          assert.equal(indexes.filter(row => row.name === 'uq_ai_media_asset_storage_key' && Number(row.prefix || 0) > 0).length, 0);
        }
      });
    });

    await t.test('D2 admission transaction, lease CAS, outbox claim, and idempotency race', async () => {
      const config = await fresh();
      await runMigrations({ config, migrations: loadMigrations(dialect) });
      const now = 'CURRENT_TIMESTAMP';
      const keyA = postgres ? `decode('${'22'.repeat(32)}','hex')` : `X'${'22'.repeat(32)}'`;
      const keyB = postgres ? `decode('${'33'.repeat(32)}','hex')` : `X'${'33'.repeat(32)}'`;
      const hash = `'${'cd'.repeat(32)}'`;
      const casWon = result => (Array.isArray(result) ? result.length : Number(result.affectedRows)) === 1;
      await withConnection(config, async db => {
        await db.query('BEGIN');
        await db.query(`INSERT INTO ai_idempotency
          (vpbx_user_uid, stable_principal_id, operation_namespace, key_digest, request_hash, state, safe_response, expires_at, created_at, updated_at)
          VALUES (7, 'prin-d2', 'jobs.create:asset', ${keyA}, ${hash}, 'started', '{}', ${now}, ${now}, ${now})`);
        await db.query(`INSERT INTO ai_jobs
          (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
          VALUES ('d2-job-rollback', 7, 'speech_analytics', 'analyze', 'asset', 'asset-d2', 'queued', 0, ${now}, 1, ${now}, ${now})`);
        await db.query('ROLLBACK');
        assert.equal((await db.query("SELECT id FROM ai_jobs WHERE id='d2-job-rollback'")).length, 0);

        await db.query('BEGIN');
        await db.query(`INSERT INTO ai_idempotency
          (vpbx_user_uid, stable_principal_id, operation_namespace, key_digest, request_hash, state, resource_id, response_status, safe_response, expires_at, created_at, updated_at)
          VALUES (7, 'prin-d2', 'jobs.create:asset', ${keyA}, ${hash}, 'completed', 'd2-job-commit', 202, '{"jobId":"d2-job-commit"}', ${now}, ${now}, ${now})`);
        await db.query(`INSERT INTO ai_jobs
          (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version,
           idempotency_principal_id, idempotency_namespace, idempotency_key_digest, created_at, updated_at)
          VALUES ('d2-job-commit', 7, 'speech_analytics', 'analyze', 'asset', 'asset-d2', 'queued', 0, ${now}, 1,
            'prin-d2', 'jobs.create:asset', ${keyA}, ${now}, ${now})`);
        await db.query(`INSERT INTO ai_job_stages
          (id, vpbx_user_uid, job_id, stage_key, state, attempt_count, fence, version, created_at, updated_at)
          VALUES ('d2-stage-1', 7, 'd2-job-commit', 'run', 'pending', 0, 0, 1, ${now}, ${now})`);
        await db.query(`INSERT INTO ai_outbox
          (id, vpbx_user_uid, aggregate_kind, aggregate_id, aggregate_version, event_type, schema_version, payload, available_at, fence, attempts, version, created_at)
          VALUES ('d2-out-1', 7, 'job', 'd2-job-commit', 1, 'job.admitted', 1, '{"schemaVersion":1,"tenantUid":7}', ${now}, 0, 0, 1, ${now})`);
        await db.query('COMMIT');
        assert.equal((await db.query("SELECT id FROM ai_jobs WHERE id='d2-job-commit'")).length, 1);
        assert.equal((await db.query("SELECT id FROM ai_outbox WHERE id='d2-out-1' AND delivered_at IS NULL")).length, 1);
      });

      const claimSql = postgres
        ? "UPDATE ai_job_stages SET state='leased', version=version+1, fence=fence+1, lease_owner='worker-alpha', updated_at=CURRENT_TIMESTAMP WHERE id='d2-stage-1' AND version=1 RETURNING id"
        : "UPDATE ai_job_stages SET state='leased', version=version+1, fence=fence+1, lease_owner='worker-alpha', updated_at=CURRENT_TIMESTAMP WHERE id='d2-stage-1' AND version=1";
      const claimRace = await Promise.all([
        withConnection(config, session => session.query(claimSql)),
        withConnection(config, session => session.query(claimSql)),
      ]);
      assert.equal(claimRace.filter(casWon).length, 1);

      const outboxSql = postgres
        ? "UPDATE ai_outbox SET lease_owner='dispatcher-1', fence=fence+1, version=version+1, attempts=attempts+1 WHERE id='d2-out-1' AND delivered_at IS NULL AND version=1 RETURNING id"
        : "UPDATE ai_outbox SET lease_owner='dispatcher-1', fence=fence+1, version=version+1, attempts=attempts+1 WHERE id='d2-out-1' AND delivered_at IS NULL AND version=1";
      const outboxRace = await Promise.all([
        withConnection(config, session => session.query(outboxSql)),
        withConnection(config, session => session.query(outboxSql)),
      ]);
      assert.equal(outboxRace.filter(casWon).length, 1);

      await withConnection(config, async db => {
        const staleSql = postgres
          ? "UPDATE ai_job_stages SET state='succeeded' WHERE id='d2-stage-1' AND fence=99 RETURNING id"
          : "UPDATE ai_job_stages SET state='succeeded' WHERE id='d2-stage-1' AND fence=99";
        assert.equal(casWon(await db.query(staleSql)), false);
        await db.query("UPDATE ai_job_stages SET state='executing' WHERE id='d2-stage-1' AND fence=1");
        const goodSql = postgres
          ? "UPDATE ai_job_stages SET state='succeeded', lease_owner=NULL WHERE id='d2-stage-1' AND fence=1 RETURNING id"
          : "UPDATE ai_job_stages SET state='succeeded', lease_owner=NULL WHERE id='d2-stage-1' AND fence=1";
        assert.equal(casWon(await db.query(goodSql)), true);
        await db.query("UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP, lease_owner=NULL WHERE id='d2-out-1'");
        const replaySql = postgres
          ? "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP WHERE id='d2-out-1' AND delivered_at IS NULL RETURNING id"
          : "UPDATE ai_outbox SET delivered_at=CURRENT_TIMESTAMP WHERE id='d2-out-1' AND delivered_at IS NULL";
        assert.equal(casWon(await db.query(replaySql)), false);
        const uniqueRace = await Promise.allSettled([1, 2].map(() => withConnection(config, session => session.query(`INSERT INTO ai_idempotency
          (vpbx_user_uid, stable_principal_id, operation_namespace, key_digest, request_hash, state, safe_response, expires_at, created_at, updated_at)
          VALUES (7, 'prin-d2', 'jobs.create:asset', ${keyB}, ${hash}, 'started', '{}', ${now}, ${now}, ${now})`))));
        assert.deepEqual(uniqueRace.map(result => result.status).sort(), ['fulfilled', 'rejected']);
      });
    });
  });
}
