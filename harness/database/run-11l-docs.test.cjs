'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  LADDER, measureAdmissionLadder, mediaNotStarvedByBatch, quotaFailClosed, publishedProfile,
} = require('./load-profile.cjs');

test('11L ladder is 1→5→20 and admits under default caps', () => {
  const ladder = measureAdmissionLadder();
  assert.deepEqual(ladder.map((row) => row.concurrency), [...LADDER]);
  for (const row of ladder) {
    assert.equal(row.admitted, row.concurrency);
    assert.equal(row.errors, 0);
  }
});

test('batch fairness exhaustion does not starve media admits', () => {
  const media = mediaNotStarvedByBatch();
  assert.equal(media.batchBlocked, true);
  assert.equal(media.mediaAdmitted, true);
});

test('quota fail-closed returns fairness_exhausted', () => {
  const quota = quotaFailClosed();
  assert.equal(quota.rejected, true);
  assert.equal(quota.code, 'fairness_exhausted');
  const profile = publishedProfile(measureAdmissionLadder(), { quota });
  assert.equal(profile.productSlaClaimed, false);
});

test('load profile docs name measurement not SLA', () => {
  const docs = fs.readFileSync(path.join(
    __dirname, '../../.planning/initiatives/ai-products/AI-11-11L-LOAD.md',
  ), 'utf8');
  assert.match(docs, /1→5→20|1->5->20/);
  assert.match(docs, /not .*product SLA|не .*лимит продукта|productSlaClaimed:\s*false/i);
  assert.match(docs, /fairness_exhausted|quota fail-closed/i);
  assert.match(docs, /media/i);
  assert.doesNotMatch(docs, /\/etc\/asterisk/);
});
