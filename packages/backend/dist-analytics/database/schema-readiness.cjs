'use strict';

const { resolveDatabaseConfig } = require('./database-config.cjs');
const { loadMigrations, runMigrations } = require('../../database/migration-runner.cjs');

function assertReady(status, migrations, dialect, profile = 'full-pbx') {
  const expected = migrations.at(-1)?.id;
  if (!expected || status.engine !== dialect) throw new Error('Database schema readiness: engine mismatch');
  if (status.historyState !== 'versioned') {
    throw new Error('Database schema readiness: unversioned schema; review the existing database and run db:migrate before startup');
  }
  if (status.profile !== undefined && status.profile !== profile) {
    throw new Error('Database schema readiness: profile mismatch');
  }
  if (status.profileState === 'legacy-full-pbx') {
    throw new Error('Database schema readiness: profile_upgrade_required; run db:migrate before startup');
  }
  if (status.dirty) throw new Error('Database schema readiness: interrupted migration; inspect db:migrate:status and repair before startup');
  if (status.schemaVersion !== expected || status.pending.length) {
    throw new Error(`Database schema readiness: expected ${expected}; run db:migrate before startup`);
  }
  return { engine: dialect, schemaVersion: expected };
}

async function checkSchemaReadiness(input = process.env) {
  const config = resolveDatabaseConfig(input);
  const profile = input.DB_SCHEMA_PROFILE || 'full-pbx';
  const migrations = loadMigrations(config.dialect, profile);
  const status = await runMigrations({ config, migrations, profile, mode: 'status' });
  return assertReady(status, migrations, config.dialect, profile);
}

module.exports = { assertReady, checkSchemaReadiness };
