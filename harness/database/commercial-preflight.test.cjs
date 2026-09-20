'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateCommercialPreflight } = require('./commercial-preflight.cjs');

test('commercial preflight refuses a missing profile and a publisher private key', () => {
  const denied = evaluateCommercialPreflight({
    DB_DIALECT: 'postgres', NODE_ENV: 'production',
  });
  assert.equal(denied.ok, false);
  assert.ok(denied.missing.includes('DB_SCHEMA_PROFILE'));
  const publisher = evaluateCommercialPreflight({
    DB_DIALECT: 'mysql', DB_SCHEMA_PROFILE: 'analytics-api',
    CC_AI_KEY_SECRET: 'x'.repeat(32), AI_WORKERS_CONFIGURED: '1',
    AI_PUBLISHER_PRIVATE_KEY: 'should-never-ship',
  });
  assert.equal(publisher.ok, false);
  assert.ok(publisher.missing.includes('publisher_private_key_must_not_be_in_customer_install'));
});

test('commercial preflight accepts a pinned dialect, profile, customer data key and workers flag', () => {
  const result = evaluateCommercialPreflight({
    DB_DIALECT: 'postgres', DB_SCHEMA_PROFILE: 'robot-api',
    CC_AI_KEY_SECRET: 'customer-data-key', AI_WORKERS_CONFIGURED: '1',
    AI_LICENSE_PROFILE: 'offline',
  });
  assert.deepEqual(result, {
    ok: true, dialect: 'postgres', profile: 'robot-api', missing: [],
  });
});
