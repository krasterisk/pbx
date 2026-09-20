'use strict';

const { evaluateCommercialPreflight } = require('./commercial-preflight.cjs');
const { loadMigrations, runMigrations } = require('../../packages/backend/database/migration-runner.cjs');
const { main: runMigrate } = require('../../packages/backend/database/run-migrations.cjs');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { checkSchemaReadiness } = require('../../packages/backend/src/database/schema-readiness.cjs');
const { CURRENT_SCHEMA, installPlan } = require('./clean-install.cjs');

const UPGRADE_STEPS = Object.freeze([
  'backup',
  'migrate',
  'health/schema readiness',
  'worker drain',
  'admit traffic',
]);
const SKU_TABLES = Object.freeze(['ai_trial_policy_snapshots', 'ai_sku_revisions', 'ai_sku_offers', 'ai_sku_entitlements']);
const JOB_ID = 'bbbbbbbb-0000-4000-8000-000000000031';
const LICENSE_UID = 'bbbbbbbb-0000-4000-8000-000000000032';
const PBX_ONLY = '0019-asterisk-odbc.sql';
const STANDALONE_N1 = '0018-ai-tools.sql';

function fail(message) {
  throw new Error(message);
}

function n1Schema(dialect, profile) {
  const ids = installPlan(dialect, profile).ids;
  if (ids.at(-1) !== CURRENT_SCHEMA) fail(`expected current schema ${CURRENT_SCHEMA}`);
  if (ids.length < 2) fail('profile has no N-1 additive');
  const previous = ids.at(-2);
  if (profile === 'full-pbx' && previous !== PBX_ONLY) fail(`full-pbx N-1 must be ${PBX_ONLY}`);
  if (profile !== 'full-pbx' && previous !== STANDALONE_N1) fail(`standalone N-1 must be ${STANDALONE_N1}`);
  return previous;
}

function upgradePlan(dialect, profile) {
  return {
    dialect,
    profile,
    from: n1Schema(dialect, profile),
    to: CURRENT_SCHEMA,
    steps: [...UPGRADE_STEPS],
    emptyInstallBaseline: 'I1 clean-install 0001→current; not rewritten here',
    recovery: 'forward repair or restore a backup; automatic rollback is not supported',
  };
}

function mayAdmitTraffic({ schemaReady, drained, workersReady }) {
  if (!schemaReady) fail('schema not ready; do not admit traffic');
  if (!drained) fail('workers must drain before admitting traffic');
  if (!workersReady) fail('workers not ready; do not admit traffic');
  return { admitted: true };
}

async function applyN1(env = process.env) {
  const dialect = env.DB_DIALECT || 'mysql';
  const profile = env.DB_SCHEMA_PROFILE || 'full-pbx';
  const plan = upgradePlan(dialect, profile);
  const all = loadMigrations(dialect, profile);
  const sliced = all.slice(0, all.findIndex((item) => item.id === plan.from) + 1);
  const config = resolveDatabaseConfig(env, { requireExplicitConnection: true });
  const applied = await runMigrations({ config, migrations: sliced, profile, mode: 'apply' });
  return { ok: true, mode: 'n1', plan, applied, schemaVersion: applied.schemaVersion };
}

async function seedUpgradeFixture(adapter, tenantUid = 1) {
  const now = "'2026-09-20 12:00:00.000'";
  await adapter.query(`INSERT INTO ai_local_license_documents
    (uid, license_id, revision, vpbx_user_uid, installation_id,
     payload_bytes, signature_bytes, digest_sha256, imported_at,
     imported_by, max_observed_at)
    VALUES ('${LICENSE_UID}', '00000000-0000-4000-8000-000000000041', 1,
      ${tenantUid}, 'i3-installation', 'payload', 'signature', '${'ab'.repeat(32)}',
      ${now}, 1, ${now})`);
  await adapter.query(`INSERT INTO ai_local_license_bindings
    (vpbx_user_uid, product, document_uid, revision, actor_user_id, updated_at)
    VALUES (${tenantUid}, 'speech_analytics', '${LICENSE_UID}', 1, 1, ${now})`);
  await adapter.query(`INSERT INTO ai_jobs
    (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
    VALUES ('${JOB_ID}', ${tenantUid}, 'speech_analytics', 'analyze', 'asset', 'asset-i3', 'queued', 0, ${now}, 1, ${now}, ${now})`);
  return { tenantUid, jobId: JOB_ID, licenseUid: LICENSE_UID };
}

async function upgrade(args = process.argv.slice(2), env = process.env) {
  if (args.includes('--rollback')) {
    fail('Automatic rollback is not supported; use a reviewed forward migration or restore a backup.');
  }
  const unknown = args.filter((arg) => !['--plan', '--status', '--apply-n1', '--upgrade'].includes(arg));
  if (unknown.length) fail(`Usage: upgrade.cjs [--plan|--status|--apply-n1|--upgrade]; unknown ${unknown.join(',')}`);
  const dialect = env.DB_DIALECT || 'mysql';
  const profile = env.DB_SCHEMA_PROFILE || 'full-pbx';
  const plan = upgradePlan(dialect, profile);
  if (args.includes('--plan')) return { ok: true, mode: 'plan', plan };

  if (env.KRASTERISK_BINARY !== 'community-pbx' && !args.includes('--status')) {
    const preflight = evaluateCommercialPreflight({ ...env, DB_DIALECT: dialect, DB_SCHEMA_PROFILE: profile });
    if (!preflight.ok) fail(`preflight failed: ${preflight.missing.join(',')}`);
  }

  if (args.includes('--apply-n1')) return applyN1(env);

  const applied = await runMigrate(args.includes('--status') ? ['--status'] : [], env);
  if (args.includes('--status')) {
    return { ok: !applied.dirty, mode: 'status', plan, applied };
  }
  if (applied.dirty) fail('Interrupted/failed migration marker present; review schema and journal, then forward repair or restore backup');
  const readiness = await checkSchemaReadiness(env);
  if (readiness.schemaVersion !== CURRENT_SCHEMA) {
    fail(`upgrade did not reach ${CURRENT_SCHEMA}`);
  }
  return {
    ok: true,
    mode: 'upgrade',
    plan,
    applied,
    readiness,
    next: 'worker drain then admit traffic',
  };
}

if (require.main === module) {
  upgrade().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CURRENT_SCHEMA,
  UPGRADE_STEPS,
  SKU_TABLES,
  JOB_ID,
  LICENSE_UID,
  n1Schema,
  upgradePlan,
  mayAdmitTraffic,
  applyN1,
  seedUpgradeFixture,
  upgrade,
};
