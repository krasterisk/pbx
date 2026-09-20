'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const docs = fs.readFileSync(path.join(
  __dirname, '../../.planning/initiatives/ai-products/AI-10-10R-AI-VOICE.md',
), 'utf8');

test('robots curl publishes a version before browser_test deployment', () => {
  assert.match(docs, /\/agents\/\$AGENT_UID\/publish/);
  assert.match(docs, /browser_test/);
  assert.match(docs, /sip_profile_unsupported/);
  assert.match(docs, /admissions_stopped|drain/);
  assert.ok(docs.includes('Query `?token=` is rejected'));
});

test('robots-only smoke does not claim I4 native CDR', () => {
  assert.match(docs, /do not wait for I4/i);
  assert.doesNotMatch(docs, /\/etc\/asterisk/);
});
