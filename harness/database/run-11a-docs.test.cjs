'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { REMAINING_GATES, buildEvalReport } = require('./analytics-uat.cjs');

test('11A remaining gates name local-AI and MET5 as open', () => {
  assert.ok(REMAINING_GATES.includes('local_ai_stt_not_claimed'));
  assert.ok(REMAINING_GATES.includes('met5_30_call_holdout_not_claimed'));
});

test('eval report is measurement not SLA', () => {
  const report = buildEvalReport({
    dialect: 'mysql',
    schemaVersion: '0020-ai-sku-catalog.sql',
    pilots: [{ tenant: 'a' }, { tenant: 'b' }],
    isolation: { bCannotReadA: true, aCannotReadB: true },
  });
  assert.equal(report.productSlaClaimed, false);
  assert.equal(report.env.productRuntime, 'not-installed');
  assert.equal(report.constraints.noI4AmiAri, true);
  assert.equal(report.pilots.length, 2);
});

test('11A docs name LIVE-UAT and remaining gates', () => {
  const docs = fs.readFileSync(
    path.join(__dirname, '../../.planning/initiatives/ai-products/AI-11-11A-UAT.md'),
    'utf8',
  );
  assert.match(docs, /Not a product SLA|not a product SLA/i);
  assert.match(docs, /LIVE-UAT|live-uat/i);
  assert.match(docs, /local-AI|local_ai/i);
  assert.match(docs, /MET5|met5/i);
  assert.match(docs, /Pilot B|pilot B/i);
});
