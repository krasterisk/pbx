'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  evaluateSipProfile,
} = require('../../packages/backend/dist-robot/modules/ai-voice/realtime-session');

test('native_pbx_gated only when i4Evidence missing', () => {
  assert.equal(
    evaluateSipProfile({ transport: 'udp', nativePbx: true, i4Evidence: false }).reason,
    'native_pbx_gated',
  );
  const withEvidence = evaluateSipProfile({ transport: 'udp', nativePbx: true, i4Evidence: true });
  assert.notEqual(withEvidence.reason, 'native_pbx_gated');
  assert.equal(withEvidence.status, 'draft');
});

test('tls remains unsupported without certification; certified lab unlocks draft', () => {
  const tls = evaluateSipProfile({ transport: 'tls', nativePbx: true, i4Evidence: true });
  assert.equal(tls.status, 'disabled');
  assert.equal(tls.reason, 'sip_profile_unsupported');
  const certified = evaluateSipProfile({
    transport: 'tls', nativePbx: true, i4Evidence: true, certified: true,
  });
  assert.equal(certified.status, 'draft');
  assert.equal(certified.reason, null);
});

test('pending-gates matrix documents PASS host ODBC; TLS lab signalling named separately', () => {
  const matrix = fs.readFileSync(
    path.join(__dirname, '../../.planning/initiatives/ai-products/evidence/pending-gates/REMOTE-MATRIX.md'),
    'utf8',
  );
  assert.match(matrix, /Host unixODBC[\s\S]*?\*\*PASS\*\*/);
  assert.match(matrix, /MET5[\s\S]*?\*\*BLOCKED\*\*/);
  assert.match(matrix, /local-AI[\s\S]*?\*\*BLOCKED\*\*/);
  assert.match(matrix, /liveMcp[\s\S]*?\*\*BLOCKED\*\*/);
  assert.match(matrix, /Live Adaptive DSN secrets not read/);
  const followup = fs.readFileSync(
    path.join(__dirname, '../../.planning/initiatives/ai-products/evidence/followup-fe-tls-pilot/REMOTE-MATRIX.md'),
    'utf8',
  );
  assert.match(followup, /Lab TLS signalling[\s\S]*?\*\*PASS\*\*/);
  assert.match(followup, /SRTP media|NAT[\s\S]*?\*\*BLOCKED\*\*/);
});
