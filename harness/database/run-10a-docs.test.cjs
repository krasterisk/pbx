'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const docs = fs.readFileSync(path.join(
  __dirname, '../../.planning/initiatives/ai-products/AI-10-10A-PUBLIC-ANALYSIS.md',
), 'utf8');

test('public analysis curl grants upload and read and publishes the project', () => {
  assert.match(docs, /analytics:upload/);
  assert.match(docs, /analytics:read/);
  assert.match(docs, /\/publish/);
  assert.match(docs, /Speech Analytics Public/);
  assert.ok(docs.includes('Query `?token=` is rejected'));
});

test('analytics-only smoke does not wait on I4 ODBC', () => {
  assert.match(docs, /do not wait for I4/i);
  assert.doesNotMatch(docs, /\/etc\/asterisk/);
});
