'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  DRILL_STEPS, PROBE_CHECKLIST, refuseRollback, rehearseKeyRotation,
  probeAdmissionGate, probeDialectSwitch,
} = require('./ops-drill.cjs');

test('11O drill steps are backup→restore→upgrade→drain→admit', () => {
  assert.deepEqual(DRILL_STEPS, [
    'backup', 'restore', 'upgrade', 'schema_readiness', 'worker_drain', 'admit_traffic',
  ]);
  for (const probe of [
    'missing_key_fail_closed', 'dialect_switch_refused', 'rollback_refused', 'key_rotation_rehearsal',
  ]) {
    assert.ok(PROBE_CHECKLIST.includes(probe), probe);
  }
});

test('rollback is refused and drain gates admit', () => {
  assert.throws(() => refuseRollback(['--rollback']), /Automatic rollback/);
  const gate = probeAdmissionGate();
  assert.equal(gate.drainBlocked, true);
  assert.equal(gate.admitted, true);
});

test('dialect switch refuse and key rotation stay non-production', () => {
  assert.equal(probeDialectSwitch('mysql').refused, true);
  assert.equal(probeDialectSwitch('postgres').refused, true);
  const rotation = rehearseKeyRotation();
  assert.equal(rotation.liveProductionRotated, false);
  assert.ok(rotation.steps.length >= 3);
});

test('11O docs name AI-11 evidence wrapping I2/I3 without SLA', () => {
  const docs = fs.readFileSync(
    path.join(__dirname, '../../.planning/initiatives/ai-products/AI-11-11O-OPS.md'),
    'utf8',
  );
  assert.match(docs, /Not a product SLA|not a product SLA/i);
  assert.match(docs, /I2|I3/);
  assert.match(docs, /rollback/i);
  assert.match(docs, /named AI-11|AI-11 evidence/i);
});
