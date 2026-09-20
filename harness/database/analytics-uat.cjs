'use strict';
// AI-11 11A analytics LIVE-UAT helpers. Not a product SLA. No live debit.
const fs = require('node:fs');
const path = require('node:path');

const REMAINING_GATES = Object.freeze([
  'local_ai_stt_not_claimed',
  'met5_30_call_holdout_not_claimed',
]);

function buildEvalReport(input) {
  return {
    revision: '2026-09-20-r1',
    phase: 'AI-11',
    task: '11A',
    kind: 'LIVE-UAT-analytics',
    productSlaClaimed: false,
    env: {
      dialect: input.dialect,
      schemaProfile: 'analytics-api',
      productRuntime: 'not-installed',
      cloudWallet: 'off',
      node: process.version,
    },
    models: {
      stt: 'fake/fixture (local-AI gate open)',
      analysis: 'fixture pipeline',
    },
    versions: {
      schema: input.schemaVersion,
      pack: input.packSha || null,
    },
    pilots: input.pilots,
    isolation: input.isolation,
    remainingGates: REMAINING_GATES.slice(),
    constraints: {
      noLiveTenantDebit: true,
      noAutodial: true,
      noXrayUi: true,
      noI4AmiAri: true,
    },
  };
}

function writeEvalReport(outDir, dialect, report) {
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `eval-${dialect}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
  return outFile;
}

module.exports = { REMAINING_GATES, buildEvalReport, writeEvalReport };
