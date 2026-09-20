'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  PENDING_GATES, aggregateMatrix, assertNoSilentMock, evidenceExists,
} = require('./release-matrix.cjs');

test('11M pending gates are explicitly open-named', () => {
  for (const gate of PENDING_GATES) {
    assert.match(gate, /not_|still_/);
  }
  assert.ok(PENDING_GATES.includes('met5_30_call_holdout_not_claimed'));
  assert.ok(PENDING_GATES.includes('commercial_readiness_not_declared'));
});

test('aggregate matrix refuses SLA and requires prior evidence slices', () => {
  const matrix = aggregateMatrix([]);
  assertNoSilentMock(matrix);
  assert.equal(matrix.productSlaClaimed, false);
  assert.equal(matrix.commercialReadinessDeclared, false);
  assert.equal(evidenceExists('11a').present, true);
  assert.equal(evidenceExists('11r').present, true);
  assert.equal(evidenceExists('11o').present, true);
  assert.equal(evidenceExists('11f').present, true);
  assert.equal(evidenceExists('11l').present, true);
});

test('11M docs name RELEASE matrix and pending gates', () => {
  const docs = fs.readFileSync(
    path.join(__dirname, '../../.planning/initiatives/ai-products/AI-11-11M-MATRIX.md'),
    'utf8',
  );
  assert.match(docs, /Not a product SLA|not a product SLA/i);
  assert.match(docs, /pending|MET5|liveMcp/i);
  assert.match(docs, /DBR-07|version-skew/i);
  assert.match(docs, /no silent|named/i);
});
