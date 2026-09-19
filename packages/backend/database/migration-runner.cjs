'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { connectAdapter, JOURNAL, STATE } = require('./migration-adapter.cjs');

class MigrationError extends Error {}
const fail = message => { throw new MigrationError(message); };
const checksum = sql => crypto.createHash('sha256').update(sql).digest('hex');

function loadMigrations(dialect, profile = 'full-pbx') {
  if (!['mysql', 'postgres'].includes(dialect)) fail('Unsupported migration dialect');
  if (!['full-pbx', 'analytics-api', 'robot-api'].includes(profile)) fail('Schema profile is not implemented; no database connection attempted');
  const root = path.join(__dirname, 'migrations');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.version !== 2) fail('Unsupported migration manifest version');
  const selection = manifest.dialects[dialect];
  if (!selection?.baselineImplemented) fail(`${dialect} production baseline not implemented (DB-02); no database connection attempted`);
  const selected = profile === 'full-pbx' ? selection.migrations : selection.profiles?.[profile];
  if (!Array.isArray(selected)) fail('Schema profile is not implemented; no database connection attempted');
  const artifacts = Object.values(manifest.dialects).flatMap(entry => [
    ...entry.migrations.map(migration => migration.artifact),
    ...Object.values(entry.profiles ?? {}).flatMap(migrations => migrations.map(migration => migration.artifact)),
  ]);
  const files = fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith('.sql')).map(file => file.replaceAll('\\', '/'));
  if (files.some(file => !artifacts.includes(file)) || artifacts.some(file => !files.includes(file))) fail('Migration manifest and SQL artifacts differ');
  return selected.map(({ id, artifact }) => {
    if (!/^[a-zA-Z0-9_./-]+\.sql$/.test(artifact) || artifact.split('/').some(part => part === '..' || part === '.') || path.isAbsolute(artifact)) fail('Invalid migration artifact path');
    const sql = fs.readFileSync(path.join(root, artifact), 'utf8');
    return { id, artifact, sql, checksum: checksum(sql) };
  });
}

function validateMigrations(migrations) {
  const seen = new Set();
  for (const migration of migrations) {
    if (!/^\d[\w.-]*\.sql$/.test(migration.id) || migration.id.length > 255 || seen.has(migration.id)) fail('Invalid or duplicate migration ID');
    if (typeof migration.sql !== 'string' || !migration.sql.trim() || checksum(migration.sql) !== migration.checksum) fail('Invalid migration artifact checksum');
    seen.add(migration.id);
  }
  if ([...seen].sort().join('\n') !== [...seen].join('\n')) fail('Migration IDs must be sorted');
}

async function inspect(adapter, migrations, profile) {
  const tables = await adapter.tables();
  const hasJournal = tables.includes(JOURNAL);
  const hasState = tables.includes(STATE);
  if (tables.length && !hasJournal) fail('Existing unversioned schema: baseline requires an empty database; review and reconcile before adoption');
  const applied = hasJournal ? await adapter.readJournal() : [];
  let dirty = null;
  let profileState = 'empty';
  if (hasState) {
    const rows = await adapter.readState();
    if (rows.length !== 1 || Number(rows[0].id) !== 1) fail('Incomplete migration metadata; review required');
    if (rows[0].engine !== adapter.dialect) fail('Migration engine identity mismatch; changing DB_DIALECT does not transfer data');
    if (rows[0].profile === null || rows[0].profile === undefined) {
      if (profile !== 'full-pbx') fail('Schema profile_upgrade_required; legacy journal belongs to full-pbx');
      profileState = 'legacy-full-pbx';
    } else if (rows[0].profile !== profile) {
      fail('Schema profile mismatch; explicit profile upgrade is required');
    } else {
      profileState = 'versioned';
    }
    if ((rows[0].dirty_name === null) !== (rows[0].dirty_checksum === null)) fail('Incomplete dirty migration marker; review required');
    if (rows[0].dirty_name !== null) dirty = { name: rows[0].dirty_name, checksum: rows[0].dirty_checksum };
  } else if (hasJournal && !applied.length && tables.some(table => table !== JOURNAL)) {
    fail('Unjournaled partial schema from a legacy runner; review required');
  }
  for (let i = 0; i < applied.length; i++) {
    if (applied[i].name !== migrations[i]?.id) fail('Migration history is not a prefix of the selected manifest; review required');
    if (applied[i].checksum !== migrations[i].checksum) fail(`Applied migration changed: ${migrations[i].id}`);
  }
  return {
    engine: adapter.dialect,
    schemaVersion: applied.at(-1)?.name ?? null,
    applied: applied.map(row => row.name),
    pending: migrations.slice(applied.length).map(migration => migration.id),
    historyState: hasState ? 'versioned' : hasJournal ? 'legacy' : 'empty',
    profile,
    profileState,
    dirty,
  };
}

async function preflightMigrationData(adapter, migration) {
  if (migration.id === '0007-tenant-login-uniqueness.sql') {
    // Login matching is case-insensitive in both engines. An existing
    // duplicate needs operator reconciliation before any DDL/dirty marker.
    const rows = await adapter.query(`SELECT 1 FROM users WHERE login IS NOT NULL
      GROUP BY LOWER(login) HAVING COUNT(*) > 1 LIMIT 1`);
    if (rows.length) fail(`Duplicate users login keys; reconcile data before ${migration.id}`);
    return;
  }
  if (migration.id !== '0003-callcenter-report-keys.sql') return;
  // Run before marking the migration dirty. Existing duplicate legacy data
  // needs an explicit operator reconciliation, never an automatic deletion.
  for (const [table, key] of [
    ['cc_queue_calls', 'vpbx_user_uid, call_uniqueid'],
    ['cc_daily_queue_stats', 'vpbx_user_uid, stat_date, queue_name'],
    ['cc_daily_agent_stats', 'vpbx_user_uid, stat_date, agent_interface'],
  ]) {
    const rows = await adapter.query(`SELECT 1 FROM ${table} GROUP BY ${key} HAVING COUNT(*) > 1 LIMIT 1`);
    if (rows.length) fail(`Duplicate ${table} business keys; reconcile data before ${migration.id}`);
  }
}

async function runMigrations({ config, migrations, profile = 'full-pbx', mode = 'apply', lockTimeoutMs = 30000, adapterFactory = connectAdapter }) {
  if (!['apply', 'status'].includes(mode)) fail('Unsupported migration mode');
  if (!['mysql', 'postgres'].includes(config.dialect)) fail('Unsupported migration dialect');
  if (!['full-pbx', 'analytics-api', 'robot-api'].includes(profile)) fail('Unsupported schema profile; no database connection attempted');
  if (!Number.isInteger(lockTimeoutMs) || lockTimeoutMs < 0 || lockTimeoutMs > 300000) fail('Invalid migration lock timeout');
  validateMigrations(migrations);
  let adapter;
  let result;
  let failure;
  try {
    adapter = await adapterFactory(config);
    if (!await adapter.acquireLock(lockTimeoutMs)) fail('Migration lock unavailable (timeout)');
    result = await inspect(adapter, migrations, profile);
    if (mode === 'apply') {
      if (result.dirty) fail('Interrupted/failed migration marker present; review schema and journal, then forward repair or restore backup');
      if (result.historyState !== 'versioned') await adapter.initialize(result.historyState === 'legacy', profile);
      else if (result.profileState === 'legacy-full-pbx') await adapter.ensureProfile(profile);
      for (const migration of migrations.slice(result.applied.length)) {
        await preflightMigrationData(adapter, migration);
        await adapter.markDirty(migration);
        await adapter.apply(migration);
      }
      result = { ...await inspect(adapter, migrations, profile), newlyApplied: result.pending };
    }
  } catch (error) {
    failure = error;
  } finally {
    if (adapter) {
      try { await adapter.releaseLock(); } catch (error) { failure ??= error; }
      try { await adapter.close(); } catch (error) { failure ??= error; }
    }
  }
  if (failure) {
    if (failure instanceof MigrationError) throw failure;
    const code = /^[A-Z0-9_]{1,64}$/.test(failure.code || '') ? ` (${failure.code})` : '';
    // Driver errors may embed passwords, SQL or values. Preserve only a safe code.
    throw new MigrationError(`Database migration operation failed${code}; inspect connectivity/permissions and read-only migration status`);
  }
  return result;
}

module.exports = { loadMigrations, runMigrations, checksum, MigrationError };
