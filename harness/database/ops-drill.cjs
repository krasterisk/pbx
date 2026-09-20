'use strict';
// AI-11 11O ops drill helpers. Wrap I2/I3; do not own SQL runners. No --rollback.
const {
  DIALECT_SWITCH_MESSAGE,
  assertSameEngine,
  generateDisposableKey,
} = require('./backup-restore.cjs');
const { mayAdmitTraffic, upgradePlan } = require('./upgrade.cjs');

const DRILL_STEPS = Object.freeze([
  'backup',
  'restore',
  'upgrade',
  'schema_readiness',
  'worker_drain',
  'admit_traffic',
]);

const PROBE_CHECKLIST = Object.freeze([
  'schema_version_current',
  'ledger_sums_match',
  'job_asset_ids_present',
  'license_bindings_present',
  'encryption_key_sidecar',
  'missing_key_fail_closed',
  'dialect_switch_refused',
  'rollback_refused',
  'drain_before_admit',
  'key_rotation_rehearsal',
]);

function refuseRollback(args = ['--rollback']) {
  if (args.includes('--rollback')) {
    throw Object.assign(
      new Error('Automatic rollback is not supported; restore a backup or apply a reviewed forward migration.'),
      { code: 'rollback_refused' },
    );
  }
  return { ok: true };
}

function rehearseKeyRotation(previousKey = generateDisposableKey()) {
  const nextKey = generateDisposableKey();
  if (nextKey === previousKey) {
    throw new Error('key rotation must mint a distinct disposable secret');
  }
  return {
    previousKeyFingerprint: previousKey.slice(0, 8),
    nextKeyFingerprint: nextKey.slice(0, 8),
    steps: [
      'Generate new customer-held CC_AI_KEY_SECRET sidecar',
      'Re-encrypt provider envelopes offline with new key',
      'Place new encryption.key beside restore pack',
      'Verify decrypt with new key; old key no longer opens envelopes',
    ],
    liveProductionRotated: false,
  };
}

function probeAdmissionGate() {
  let drainBlocked = false;
  try {
    mayAdmitTraffic({ schemaReady: true, drained: false, workersReady: true });
  } catch (error) {
    drainBlocked = /drain before admitting/.test(error.message);
  }
  const admitted = mayAdmitTraffic({
    schemaReady: true, drained: true, workersReady: true,
  });
  return { drainBlocked, admitted: admitted.admitted === true };
}

function probeDialectSwitch(fromDialect) {
  const to = fromDialect === 'mysql' ? 'postgres' : 'mysql';
  let refused = false;
  try {
    assertSameEngine(
      { dialect: fromDialect, profile: 'analytics-api' },
      { DB_DIALECT: to, DB_SCHEMA_PROFILE: 'analytics-api' },
    );
  } catch (error) {
    refused = error.message.includes('DBR-07') || error.message.includes(DIALECT_SWITCH_MESSAGE.slice(0, 20));
  }
  return { refused, message: DIALECT_SWITCH_MESSAGE };
}

function publishedDrill(results) {
  return {
    revision: '2026-09-20-r1',
    phase: 'AI-11',
    task: '11O',
    productSlaClaimed: false,
    namedEvidence: 'AI-11-11O (wraps I2/I3; not a re-claim of I2/I3 alone)',
    steps: DRILL_STEPS.slice(),
    probes: PROBE_CHECKLIST.slice(),
    results,
    constraints: {
      noLiveTenantDebit: true,
      noAutodial: true,
      noXrayUi: true,
      noAutomaticRollback: true,
      productRuntime: 'not-installed',
      cloudWallet: 'off',
    },
  };
}

module.exports = {
  DRILL_STEPS,
  PROBE_CHECKLIST,
  refuseRollback,
  rehearseKeyRotation,
  probeAdmissionGate,
  probeDialectSwitch,
  publishedDrill,
  upgradePlan,
  DIALECT_SWITCH_MESSAGE,
};
