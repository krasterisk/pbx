'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadMigrations, runMigrations, checksum } = require('../migration-runner.cjs');
const { main } = require('../run-migrations.cjs');
const { JOURNAL, STATE } = require('../migration-adapter.cjs');
const { build: buildMinimalBaseline, tables: minimalTables } = require('../../../../harness/database/build-minimal-baseline.cjs');

test('MySQL selection preserves applied baseline artifact and checksum', () => {
  const migrations = loadMigrations('mysql');
  assert.equal(migrations[0].id, '0001-current-schema.sql');
  // Original committed artifact uses LF; hashes are intentionally byte-sensitive.
  assert.equal(migrations[0].checksum, '8c18e47d94da3c3aeca3807eb44dbd0280433c1dedf96bef36470203d699543d');
});

test('production PG selects the reviewed baseline offline and rejects arbitrary SQL flags', async () => {
  const input = { DB_DIALECT: 'postgres', DB_HOST: 'must-not-resolve.invalid', DB_USER: 'nobody', DB_PASSWORD: 'secret', DB_NAME: 'none' };
  const result = await main(['--list'], input);
  assert.equal(result.engine, 'postgres');
  assert.deepEqual(result.migrations.map(migration => migration.id), ['0001-current-schema.sql', '0002-cdr-query-indexes.sql', '0003-callcenter-report-keys.sql', '0004-ai-product-access.sql', '0005-ai-integration-credentials.sql', '0006-ai-integration-auth-limits.sql', '0007-tenant-login-uniqueness.sql', '0008-ai-jobs-assets.sql', '0009-ai-usage.sql', '0010-ai-capture.sql', '0011-speech-analytics.sql', '0012-ai-webhooks.sql', '0013-ai-voice.sql', '0014-sa-metrics.sql', '0015-sa-reporting.sql', '0016-sa-native-int.sql', '0017-ai-realtime.sql', '0018-ai-tools.sql', '0019-asterisk-odbc.sql']);
  assert.equal(result.migrations[0].artifact, 'postgres/0001-current-schema.sql');
  assert.equal(result.migrations[0].checksum, 'a7d418f512e6534c8d94bcf90fef4be28263634a5eb1c5774a787baa89d1720f');
  await assert.rejects(main(['--fixtures'], input), /Usage/);
  await assert.rejects(main(['--rollback'], input), /Automatic rollback is not supported/);
});

test('list is offline, includes artifact checksums and no connection details', async () => {
  const result = await main(['--list'], {});
  assert.equal(result.engine, 'mysql');
  assert.equal(result.migrations[0].id, '0001-current-schema.sql');
  assert.equal(result.password, undefined);
});

test('an unimplemented profile refuses before any database connection', async () => {
  await assert.rejects(main(['--list'], { DB_SCHEMA_PROFILE: 'video-api' }), /profile is not implemented/);
  let connected = false;
  await assert.rejects(runMigrations({ config: { dialect: 'mysql' }, migrations: [initial],
    profile: 'video-api', adapterFactory: () => { connected = true; } }), /Unsupported schema profile/);
  assert.equal(connected, false);
});

test('standalone AI profiles select one neutral baseline and shared migrations on both engines', () => {
  for (const dialect of ['mysql', 'postgres']) {
    const full = loadMigrations(dialect);
    const analytics = loadMigrations(dialect, 'analytics-api');
    const robot = loadMigrations(dialect, 'robot-api');
    assert.equal(analytics[0].id, '0001-ai-standalone-base.sql');
    assert.deepEqual(robot, analytics);
    const sharedFull = full.slice(3).filter(item => item.id !== '0019-asterisk-odbc.sql');
    assert.deepEqual(analytics.slice(1).map(item => item.id), sharedFull.map(item => item.id));
    assert.deepEqual(analytics.slice(1).map(item => item.checksum), sharedFull.map(item => item.checksum));
    assert.equal(full.at(-1).id, '0019-asterisk-odbc.sql');
    assert.ok(!analytics.some(item => item.id === '0019-asterisk-odbc.sql'));
    assert.doesNotMatch(analytics[0].sql, /CREATE TABLE (?:IF NOT EXISTS )?[`"]?(?:contexts|cdr|queue_log|ps_endpoints|ac_campaigns)[`"]?\b/i);
  }
});

test('minimal table ownership is unique and generated artifacts match the reviewed baselines', () => {
  assert.equal(new Set(minimalTables).size, minimalTables.length);
  const generated = buildMinimalBaseline();
  for (const [dialect, sql] of Object.entries(generated)) {
    const selected = loadMigrations(dialect, 'analytics-api');
    assert.equal(selected[0].sql, sql);
    const baseTables = new Set(minimalTables);
    for (const migration of selected.slice(1)) {
      const created = [...migration.sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?[`"]?([a-z_]+)[`"]?/gi)]
        .map(match => match[1]);
      assert.ok(created.every(table => !baseTables.has(table)),
        `${dialect} duplicate base ownership in ${migration.id}`);
    }
  }
});

test('artifact validation happens before connecting', async () => {
  let connected = false;
  await assert.rejects(runMigrations({ config: { dialect: 'mysql' }, migrations: [{ id: '0001.sql', sql: 'SELECT 1', checksum: 'wrong' }], adapterFactory: () => { connected = true; } }), /artifact checksum/);
  assert.equal(connected, false);
});

test('SQL failure keeps dirty marker, closes session and redacts driver detail', async () => {
  const calls = [];
  const sql = 'CREATE TABLE fixture (id INTEGER)';
  const adapter = {
    dialect: 'mysql',
    acquireLock: async () => true, tables: async () => [],
    initialize: async () => calls.push('initialize'),
    markDirty: async () => calls.push('dirty'),
    apply: async () => { calls.push('apply'); throw Object.assign(new Error('password=secret SQL values'), { code: 'ER_PARSE_ERROR' }); },
    releaseLock: async () => calls.push('release'), close: async () => calls.push('close'),
  };
  await assert.rejects(runMigrations({ config: { dialect: 'mysql' }, migrations: [{ id: '0001.sql', sql, checksum: checksum(sql) }], adapterFactory: async () => adapter }), error => {
    assert.match(error.message, /ER_PARSE_ERROR/);
    assert.doesNotMatch(error.message, /secret|SQL values/);
    return true;
  });
  assert.deepEqual(calls, ['initialize', 'dirty', 'apply', 'release', 'close']);
});

test('session is closed even if explicit unlock fails', async () => {
  let closed = false;
  await assert.rejects(runMigrations({ config: { dialect: 'postgres' }, migrations: [], mode: 'status', adapterFactory: async () => ({
    dialect: 'postgres', acquireLock: async () => true, tables: async () => [],
    releaseLock: async () => { throw new Error('disconnected'); }, close: async () => { closed = true; },
  }) }), /operation failed/);
  assert.equal(closed, true);
});

const initial = { id: '0001.sql', sql: 'SELECT 1', checksum: checksum('SELECT 1') };

test('legacy full-pbx state is explicitly upgraded before applying new migrations', async () => {
  const calls = [];
  let profile = null;
  const adapter = {
    dialect: 'mysql', acquireLock: async () => true,
    tables: async () => [JOURNAL, STATE], readJournal: async () => [],
    readState: async () => [{ id: 1, engine: 'mysql', profile, dirty_name: null, dirty_checksum: null }],
    ensureProfile: async (selected) => { calls.push('upgrade'); profile = selected; },
    markDirty: async () => calls.push('dirty'),
    apply: async () => calls.push('apply'),
    releaseLock: async () => calls.push('release'), close: async () => calls.push('close'),
  };
  const status = await runMigrations({ config: { dialect: 'mysql' }, migrations: [initial],
    mode: 'status', adapterFactory: async () => adapter });
  assert.equal(status.profileState, 'legacy-full-pbx');
  assert.deepEqual(calls, ['release', 'close']);
  calls.length = 0;
  await runMigrations({ config: { dialect: 'mysql' }, migrations: [initial],
    adapterFactory: async () => adapter });
  assert.deepEqual(calls, ['upgrade', 'dirty', 'apply', 'release', 'close']);
  assert.equal(profile, 'full-pbx');
});

test('a database bound to a different profile refuses before mutation', async () => {
  const calls = [];
  await assert.rejects(runMigrations({ config: { dialect: 'mysql' }, migrations: [initial],
    adapterFactory: async () => ({ dialect: 'mysql', acquireLock: async () => true,
      tables: async () => [JOURNAL, STATE], readJournal: async () => [],
      readState: async () => [{ id: 1, engine: 'mysql', profile: 'analytics-api',
        dirty_name: null, dirty_checksum: null }],
      initialize: async () => calls.push('write'), markDirty: async () => calls.push('write'),
      releaseLock: async () => calls.push('release'), close: async () => calls.push('close'),
    }) }), /profile mismatch/);
  assert.deepEqual(calls, ['release', 'close']);
});
for (const { name, tables, journal, state, expected } of [
  { name: 'unversioned data', tables: ['users'], expected: /unversioned schema/ },
  { name: 'unknown history', tables: [JOURNAL], journal: [{ name: '9999.sql', checksum: initial.checksum }], expected: /not a prefix/ },
  { name: 'legacy partial DDL', tables: [JOURNAL, 'users'], journal: [], expected: /Unjournaled partial/ },
  { name: 'missing state row', tables: [JOURNAL, STATE], journal: [], state: [], expected: /Incomplete migration metadata/ },
  { name: 'wrong engine', tables: [JOURNAL, STATE], journal: [], state: [{ id: 1, engine: 'postgres', dirty_name: null, dirty_checksum: null }], expected: /engine identity mismatch/ },
  { name: 'half-written dirty marker', tables: [JOURNAL, STATE], journal: [], state: [{ id: 1, engine: 'mysql', dirty_name: '0001.sql', dirty_checksum: null }], expected: /Incomplete dirty/ },
  { name: 'interrupted apply', tables: [JOURNAL, STATE], journal: [], state: [{ id: 1, engine: 'mysql', dirty_name: initial.id, dirty_checksum: initial.checksum }], expected: /Interrupted\/failed/ },
]) {
  test(`${name} refuses before any write and releases session`, async () => {
    const calls = [];
    const adapter = {
      dialect: 'mysql', acquireLock: async () => true, tables: async () => tables,
      readJournal: async () => journal, readState: async () => state,
      initialize: async () => calls.push('write'), markDirty: async () => calls.push('write'), apply: async () => calls.push('write'),
      releaseLock: async () => calls.push('release'), close: async () => calls.push('close'),
    };
    await assert.rejects(runMigrations({ config: { dialect: 'mysql' }, migrations: [initial], adapterFactory: async () => adapter }), expected);
    assert.deepEqual(calls, ['release', 'close']);
  });
}

test('read-only status exposes dirty history without clearing or initializing it', async () => {
  const calls = [];
  const result = await runMigrations({ config: { dialect: 'postgres' }, migrations: [initial], mode: 'status', adapterFactory: async () => ({
    dialect: 'postgres', acquireLock: async () => true, tables: async () => [JOURNAL, STATE], readJournal: async () => [],
    readState: async () => [{ id: 1, engine: 'postgres', dirty_name: initial.id, dirty_checksum: initial.checksum }],
    initialize: async () => calls.push('write'), markDirty: async () => calls.push('write'),
    releaseLock: async () => calls.push('release'), close: async () => calls.push('close'),
  }) });
  assert.equal(result.dirty.name, initial.id);
  assert.deepEqual(result.pending, [initial.id]);
  assert.deepEqual(calls, ['release', 'close']);
});
