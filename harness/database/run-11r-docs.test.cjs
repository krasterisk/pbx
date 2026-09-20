'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { REMAINING_GATES, buildRobotsEvalReport } = require('./robots-uat.cjs');

test('11R remaining gates name host module, TLS/NAT, liveMcp', () => {
  assert.ok(REMAINING_GATES.includes('host_unixodbc_module_load_not_claimed'));
  assert.ok(REMAINING_GATES.includes('tls_srtp_nat_not_closed'));
  assert.ok(REMAINING_GATES.includes('live_mcp_true_not_closed'));
});

test('robots eval report stays gated and not SLA', () => {
  const report = buildRobotsEvalReport({
    dialect: 'mysql',
    sip: { udpDraft: true, tlsDisabled: true, tlsReason: 'sip_profile_unsupported' },
    drain: { admissionsStopped: true, postDrainAdmitCode: 'admissions_stopped', liveSip: true },
    nativePbx: { reason: 'native_pbx_gated', hostModuleLoadClaimed: false },
  });
  assert.equal(report.productSlaClaimed, false);
  assert.equal(report.nativePbx.reason, 'native_pbx_gated');
  assert.equal(report.constraints.noLiveAdaptiveDsnOverwrite, true);
});

test('11R docs name LIVE-UAT and native_pbx_gated', () => {
  const docs = fs.readFileSync(
    path.join(__dirname, '../../.planning/initiatives/ai-products/AI-11-11R-UAT.md'),
    'utf8',
  );
  assert.match(docs, /Not a product SLA|not a product SLA/i);
  assert.match(docs, /LIVE-UAT|live-uat/i);
  assert.match(docs, /native_pbx_gated/);
  assert.match(docs, /admissions_stopped/);
});
