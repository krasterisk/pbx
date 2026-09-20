'use strict';

const { evaluateCommercialPreflight } = require('./commercial-preflight.cjs');
const { loadMigrations } = require('../../packages/backend/database/migration-runner.cjs');
const { main: runMigrate } = require('../../packages/backend/database/run-migrations.cjs');
const { seed } = require('../../packages/backend/database/seed-ci.cjs');
const { checkSchemaReadiness } = require('../../packages/backend/src/database/schema-readiness.cjs');

const INSTALL_PROFILES = Object.freeze(['full-pbx', 'analytics-api', 'robot-api']);
const CURRENT_SCHEMA = '0020-ai-sku-catalog.sql';
const PBX_ONLY = '0019-asterisk-odbc.sql';
const STANDALONE_EXCLUDED = Object.freeze(['contexts', 'cdr', 'queue_log', 'ps_endpoints', 'ac_campaigns']);
const COMMUNITY_RUNTIME_MODULES = Object.freeze(['speech-analytics', 'ai-voice']);

function fail(message) {
  throw new Error(message);
}

function installPlan(dialect, profile) {
  if (!['mysql', 'postgres'].includes(dialect)) fail('DB_DIALECT must be mysql or postgres');
  if (!INSTALL_PROFILES.includes(profile)) fail(`profile is not implemented: ${profile}`);
  const migrations = loadMigrations(dialect, profile);
  const ids = migrations.map((item) => item.id);
  return {
    dialect,
    profile,
    schemaVersion: ids.at(-1),
    expectedSchemaVersion: CURRENT_SCHEMA,
    includesPbxOdbc: ids.includes(PBX_ONLY),
    ids,
    standaloneExcluded: profile === 'full-pbx' ? [] : [...STANDALONE_EXCLUDED],
  };
}

function assertBinaryMatchesProfile(env = {}) {
  const profile = env.DB_SCHEMA_PROFILE || 'full-pbx';
  const binary = env.KRASTERISK_BINARY;
  if (!binary) return;
  if (binary === 'community-pbx') {
    if (profile !== 'full-pbx') fail('community binary refuses commercial schema profile');
    return;
  }
  if ((binary === 'analytics-api' || binary === 'robot-api') && binary !== profile) {
    fail(`${binary} API requires matching DB_SCHEMA_PROFILE`);
  }
}

function assertNoLegacySync(source) {
  if (/\bsynchronize\s*:\s*true\b/.test(source) || /\balter\s*:\s*true\b/.test(source)) {
    fail('legacy synchronize/alter is forbidden');
  }
}

async function cleanInstall(args = process.argv.slice(2), env = process.env) {
  if (args.includes('--rollback')) {
    fail('Automatic rollback is not supported; use a reviewed forward migration or restore a backup.');
  }
  const unknown = args.filter((arg) => !['--plan', '--status', '--apply', '--seed-ci'].includes(arg));
  if (unknown.length) fail(`Usage: clean-install.cjs [--plan|--status|--apply] [--seed-ci]; unknown ${unknown.join(',')}`);
  const planOnly = args.includes('--plan');
  const statusOnly = args.includes('--status');
  const seedCi = args.includes('--seed-ci');
  if (seedCi && (planOnly || statusOnly)) fail('--seed-ci requires --apply');
  const dialect = env.DB_DIALECT || 'mysql';
  const profile = env.DB_SCHEMA_PROFILE || 'full-pbx';
  assertBinaryMatchesProfile(env);
  const plan = installPlan(dialect, profile);
  if (plan.schemaVersion !== CURRENT_SCHEMA) {
    fail(`expected current schema ${CURRENT_SCHEMA}, plan lists ${plan.schemaVersion}`);
  }
  if (plan.includesPbxOdbc !== (profile === 'full-pbx')) {
    fail('0019-asterisk-odbc.sql belongs only on full-pbx');
  }
  if (planOnly) return { ok: true, mode: 'plan', plan };

  const commercial = env.KRASTERISK_BINARY !== 'community-pbx';
  if (commercial && !statusOnly) {
    const preflight = evaluateCommercialPreflight({
      ...env,
      DB_DIALECT: dialect,
      DB_SCHEMA_PROFILE: profile,
    });
    if (!preflight.ok) fail(`preflight failed: ${preflight.missing.join(',')}`);
  }

  const migrateArgs = statusOnly ? ['--status'] : [];
  const applied = await runMigrate(migrateArgs, env);
  if (statusOnly) {
    return { ok: !applied.dirty, mode: 'status', plan, applied };
  }
  if (applied.dirty) fail('Interrupted/failed migration marker present; review schema and journal, then forward repair or restore backup');
  const readiness = await checkSchemaReadiness(env);
  let seeded = null;
  if (seedCi) seeded = await seed(env);
  return {
    ok: true,
    mode: 'apply',
    plan,
    applied,
    readiness,
    seed: seeded,
  };
}

if (require.main === module) {
  cleanInstall().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  INSTALL_PROFILES,
  CURRENT_SCHEMA,
  PBX_ONLY,
  STANDALONE_EXCLUDED,
  COMMUNITY_RUNTIME_MODULES,
  installPlan,
  assertBinaryMatchesProfile,
  assertNoLegacySync,
  cleanInstall,
};
