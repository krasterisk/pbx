'use strict';
/**
 * Adopt a legacy unversioned MySQL database into the versioned migration journal,
 * then apply any still-missing additive migrations in manifest order.
 *
 * Safety:
 * - Refuses unless CONFIRM_LEGACY_ADOPT=1
 * - Never rewrites applied checksums
 * - Runs 0003/0007 preflights before those migrations
 * - For migrations whose sentinel objects already exist, records the journal row only
 *
 * Usage (from repo root, with DB_* in env or .env loaded by caller):
 *   CONFIRM_LEGACY_ADOPT=1 node packages/backend/database/adopt-unversioned-mysql.cjs
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { resolveDatabaseConfig } = require('../src/database/database-config.cjs');
const { loadMigrations, checksum, MigrationError } = require('./migration-runner.cjs');
const { JOURNAL, STATE } = require('./migration-adapter.cjs');

function loadDotEnv() {
  const file = path.join(__dirname, '../../../.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i);
    const value = line.slice(i + 1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const SENTINELS = {
  '0001-current-schema.sql': { tables: ['users', 'tenants', 'roles', 'cdr'] },
  '0002-cdr-query-indexes.sql': { indexes: [['cdr', 'idx_cdr_tenant_date'], ['cdr', 'idx_cdr_tenant_linked_date']] },
  '0003-callcenter-report-keys.sql': {
    indexes: [
      ['cc_queue_calls', 'uq_cc_queue_call_tenant_id'],
      ['cc_daily_queue_stats', 'uq_cc_daily_queue_tenant_day_name'],
      ['cc_daily_agent_stats', 'uq_cc_daily_agent_tenant_day_iface'],
    ],
  },
  '0004-ai-product-access.sql': { tables: ['ai_product_activation', 'ai_local_license_documents', 'ai_local_license_bindings'] },
  '0005-ai-integration-credentials.sql': { tables: ['ai_integration_principals', 'ai_integration_credentials'] },
  '0006-ai-integration-auth-limits.sql': { tables: ['ai_integration_auth_limits'] },
  '0007-tenant-login-uniqueness.sql': { indexes: [['users', 'uq_users_login_ci']] },
  '0008-ai-jobs-assets.sql': { tables: ['ai_jobs', 'ai_media_assets', 'ai_outbox'] },
  '0009-ai-usage.sql': { tables: ['ai_usage_events', 'ai_usage_ledger'] },
  '0010-ai-capture.sql': { tables: ['ai_capture_intents', 'ai_capture_segments'] },
  '0011-speech-analytics.sql': { tables: ['sa_projects', 'sa_recordings', 'sa_analysis_runs'] },
  '0012-ai-webhooks.sql': { tables: ['ai_webhook_endpoints', 'ai_webhook_deliveries'] },
  '0013-ai-voice.sql': { tables: ['ai_robot_drafts', 'ai_voice_sessions'] },
  '0014-sa-metrics.sql': { tables: ['sa_metric_definitions', 'sa_metric_values'] },
  '0015-sa-reporting.sql': { tables: ['sa_report_definitions', 'sa_report_runs'] },
  '0016-sa-native-int.sql': { tables: ['sa_tenant_capture_policies', 'sa_recording_relations'] },
  '0017-ai-realtime.sql': { tables: ['ai_sip_connections', 'ai_voice_invocations'] },
  '0018-ai-tools.sql': { tables: ['ai_business_connections', 'kb_bases'] },
  '0019-asterisk-odbc.sql': { tables: ['queue_log', 'cel'] },
  '0020-ai-sku-catalog.sql': { tables: ['ai_sku_catalog'] },
};

async function preflight(db, migrationId) {
  if (migrationId === '0007-tenant-login-uniqueness.sql') {
    const rows = await db.query(
      `SELECT LOWER(login) AS login, COUNT(*) AS c FROM users WHERE login IS NOT NULL
       GROUP BY LOWER(login) HAVING COUNT(*) > 1 LIMIT 5`,
    );
    if (rows[0].length) {
      throw new MigrationError(
        `Duplicate users login keys; reconcile before ${migrationId}: ${JSON.stringify(rows[0])}`,
      );
    }
  }
  if (migrationId === '0003-callcenter-report-keys.sql') {
    for (const [table, key] of [
      ['cc_queue_calls', 'vpbx_user_uid, call_uniqueid'],
      ['cc_daily_queue_stats', 'vpbx_user_uid, stat_date, queue_name'],
      ['cc_daily_agent_stats', 'vpbx_user_uid, stat_date, agent_interface'],
    ]) {
      const [rows] = await db.query(`SELECT 1 FROM ${table} GROUP BY ${key} HAVING COUNT(*) > 1 LIMIT 1`);
      if (rows.length) {
        throw new MigrationError(`Duplicate ${table} business keys; reconcile data before ${migrationId}`);
      }
    }
  }
}

async function main() {
  loadDotEnv();
  if (process.env.CONFIRM_LEGACY_ADOPT !== '1') {
    throw new Error('Refusing: set CONFIRM_LEGACY_ADOPT=1 after backup/review of the target database');
  }
  const config = resolveDatabaseConfig(process.env, { requireExplicitConnection: true });
  if (config.dialect !== 'mysql') throw new Error('This adopter supports MySQL only');
  const profile = process.env.DB_SCHEMA_PROFILE || 'full-pbx';
  const migrations = loadMigrations('mysql', profile);

  const db = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    multipleStatements: true,
    timezone: config.timezone,
  });
  await db.query('SET time_zone = ?', [config.timezone]);

  const lockRows = await db.query(
    `SELECT GET_LOCK(IF(CHAR_LENGTH(CONCAT(DATABASE(), ':migrations')) <= 64, CONCAT(DATABASE(), ':migrations'), SHA2(CONCAT(DATABASE(), ':migrations'), 256)), 30) AS acquired`,
  );
  if (Number(lockRows[0][0].acquired) !== 1) throw new Error('Migration lock unavailable');

  const actions = [];
  try {
    const [tableRows] = await db.query('SHOW TABLES');
    const tables = new Set(tableRows.map((r) => Object.values(r)[0]));
    if (!tables.has(JOURNAL)) {
      await db.query(
        `CREATE TABLE ${JOURNAL} (name VARCHAR(255) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
      );
      actions.push({ action: 'create', name: JOURNAL });
    }
    if (!tables.has(STATE)) {
      await db.query(
        `CREATE TABLE ${STATE} (id INTEGER PRIMARY KEY, engine VARCHAR(16) NOT NULL, profile VARCHAR(32) NOT NULL, dirty_name VARCHAR(255), dirty_checksum CHAR(64)) ENGINE=InnoDB`,
      );
      await db.query(`INSERT INTO ${STATE} (id, engine, profile) VALUES (1, ?, ?)`, ['mysql', profile]);
      actions.push({ action: 'create', name: STATE });
    } else {
      const [state] = await db.query(`SELECT id, engine, profile, dirty_name FROM ${STATE}`);
      if (!state.length) await db.query(`INSERT INTO ${STATE} (id, engine, profile) VALUES (1, ?, ?)`, ['mysql', profile]);
      else if (state[0].dirty_name) throw new MigrationError(`Dirty marker present: ${state[0].dirty_name}; repair before adopt`);
    }

    const [journalRows] = await db.query(`SELECT name, checksum FROM ${JOURNAL} ORDER BY name`);
    const journal = new Map(journalRows.map((r) => [r.name, r.checksum]));

    const [indexRows] = await db.query(
      `SELECT TABLE_NAME, INDEX_NAME FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE()`,
    );
    const indexes = new Set(indexRows.map((r) => `${r.TABLE_NAME}.${r.INDEX_NAME}`));
    const [freshTables] = await db.query('SHOW TABLES');
    const liveTables = new Set(freshTables.map((r) => Object.values(r)[0]));

    for (let i = 0; i < migrations.length; i += 1) {
      const migration = migrations[i];
      const expectedChecksum = checksum(migration.sql);
      if (migration.checksum !== expectedChecksum) {
        throw new MigrationError(`Checksum mismatch loading ${migration.id}`);
      }
      if (journal.has(migration.id)) {
        if (journal.get(migration.id) !== migration.checksum) {
          throw new MigrationError(`Applied migration changed: ${migration.id}`);
        }
        actions.push({ action: 'skip', id: migration.id });
        continue;
      }
      // Journal must remain a prefix: previous migrations must already be recorded.
      for (let j = 0; j < i; j += 1) {
        if (!journal.has(migrations[j].id) && !actions.some((a) => a.id === migrations[j].id && (a.action === 'adopt' || a.action === 'apply'))) {
          // After we process, we add to journal map below — check live journal map.
        }
      }
      for (let j = 0; j < i; j += 1) {
        if (!journal.has(migrations[j].id)) {
          throw new MigrationError(`Journal gap before ${migration.id}: missing ${migrations[j].id}`);
        }
      }

      const probe = SENTINELS[migration.id];
      if (!probe) throw new MigrationError(`No adoption sentinel for ${migration.id}`);
      const missingTables = (probe.tables || []).filter((t) => !liveTables.has(t));
      const missingIndexes = (probe.indexes || []).filter(([t, name]) => !indexes.has(`${t}.${name}`));
      const present = missingTables.length === 0 && missingIndexes.length === 0;

      if (present) {
        await db.query(`INSERT INTO ${JOURNAL} (name, checksum) VALUES (?, ?)`, [migration.id, migration.checksum]);
        journal.set(migration.id, migration.checksum);
        actions.push({ action: 'adopt', id: migration.id });
        continue;
      }

      await preflight(db, migration.id);
      await db.query(`UPDATE ${STATE} SET dirty_name = ?, dirty_checksum = ? WHERE id = 1`, [
        migration.id,
        migration.checksum,
      ]);
      try {
        await db.query(migration.sql);
        await db.query('START TRANSACTION');
        await db.query(`INSERT INTO ${JOURNAL} (name, checksum) VALUES (?, ?)`, [migration.id, migration.checksum]);
        await db.query(`UPDATE ${STATE} SET dirty_name = NULL, dirty_checksum = NULL WHERE id = 1`);
        await db.query('COMMIT');
        journal.set(migration.id, migration.checksum);
        // refresh live schema caches after DDL
        for (const t of probe.tables || []) liveTables.add(t);
        for (const [t, name] of probe.indexes || []) indexes.add(`${t}.${name}`);
        actions.push({ action: 'apply', id: migration.id });
      } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        throw error;
      }
    }

    const [finalJournal] = await db.query(`SELECT name FROM ${JOURNAL} ORDER BY name`);
    console.log(JSON.stringify({
      host: config.host,
      database: config.database,
      profile,
      schemaVersion: finalJournal.at(-1)?.name ?? null,
      appliedCount: finalJournal.length,
      actions,
    }, null, 2));
  } finally {
    await db.query(
      `SELECT RELEASE_LOCK(IF(CHAR_LENGTH(CONCAT(DATABASE(), ':migrations')) <= 64, CONCAT(DATABASE(), ':migrations'), SHA2(CONCAT(DATABASE(), ':migrations'), 256)))`,
    ).catch(() => {});
    await db.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof MigrationError ? error.message : error);
  process.exitCode = 1;
});
