'use strict';
// AI-11 11R robots LIVE-UAT helpers. Not a product SLA. No live debit.
const fs = require('node:fs');
const path = require('node:path');

const REMAINING_GATES = Object.freeze([
  'host_unixodbc_module_load_not_claimed',
  'tls_srtp_nat_not_closed',
  'live_mcp_true_not_closed',
]);

function buildRobotsEvalReport(input) {
  return {
    revision: '2026-09-20-r1',
    phase: 'AI-11',
    task: '11R',
    kind: 'LIVE-UAT-robots',
    productSlaClaimed: false,
    env: {
      dialect: input.dialect,
      schemaProfile: 'robot-api',
      productRuntime: 'not-installed',
      cloudWallet: 'off',
      node: process.version,
    },
    sip: input.sip,
    drain: input.drain,
    nativePbx: input.nativePbx,
    remainingGates: REMAINING_GATES.slice(),
    constraints: {
      noLiveTenantDebit: true,
      noAutodial: true,
      noXrayUi: true,
      noLiveAdaptiveDsnOverwrite: true,
      noAnalyticsEntitlement: true,
    },
  };
}

function writeRobotsEvalReport(outDir, dialect, report) {
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `eval-${dialect}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
  return outFile;
}

module.exports = { REMAINING_GATES, buildRobotsEvalReport, writeRobotsEvalReport };
