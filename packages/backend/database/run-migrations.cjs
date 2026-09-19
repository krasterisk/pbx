'use strict';
const { resolveDatabaseConfig } = require('../src/database/database-config.cjs');
const { loadMigrations, runMigrations } = require('./migration-runner.cjs');

async function main(args = process.argv.slice(2), input = process.env) {
  if (args.includes('--rollback')) throw new Error('Automatic rollback is not supported; use a reviewed forward migration or restore a backup.');
  if (args.length > 1 || args.some(arg => !['--list', '--status'].includes(arg))) throw new Error('Usage: run-migrations.cjs [--list|--status]');
  const list = args.includes('--list');
  const config = resolveDatabaseConfig(input, { requireExplicitConnection: !list });
  const profile = input.DB_SCHEMA_PROFILE || 'full-pbx';
  const migrations = loadMigrations(config.dialect, profile); // Profile guard precedes connection creation.
  if (list) return { engine: config.dialect, profile, migrations: migrations.map(({ id, artifact, checksum }) => ({ id, artifact, checksum })) };
  return runMigrations({ config, migrations, profile, mode: args.includes('--status') ? 'status' : 'apply' });
}

if (require.main === module) {
  main().then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (result.dirty) process.exitCode = 1;
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { main };
