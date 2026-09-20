'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  NAMED_FAULTS, runAllPureFaults, classifyProviderError, nextRetryDelayMs,
} = require('./fault-matrix.cjs');

test('11F named fault list covers restart/duplicate/rate-limit/storage/replay', () => {
  for (const required of [
    'api_crash_before_commit',
    'worker_restart_ordinal',
    'redis_enqueue_failure',
    'duplicate_outbox_delivery',
    'provider_rate_limit',
    'storage_unavailable',
    'idempotent_replay_zero_debit',
  ]) {
    assert.ok(NAMED_FAULTS.includes(required), required);
  }
});

test('pure fault matrix all pass without Docker', async () => {
  const results = await runAllPureFaults();
  assert.equal(results.length, NAMED_FAULTS.length);
  assert.ok(results.every((row) => row.pass === true));
  const debit = results.find((row) => row.name === 'idempotent_replay_zero_debit');
  assert.equal(debit.detail.debitCalls, 1);
  assert.equal(debit.detail.shadow, true);
});

test('rate-limit is transient and exhausts after three attempts', () => {
  assert.equal(classifyProviderError('rate_limit'), 'transient');
  assert.equal(nextRetryDelayMs(0), 1000);
  assert.equal(nextRetryDelayMs(3), null);
});

test('load profile docs name measurement not SLA for 11F docs', () => {
  const docs = fs.readFileSync(
    path.join(__dirname, '../../.planning/initiatives/ai-products/AI-11-11F-FAULT.md'),
    'utf8',
  );
  assert.match(docs, /Not a product SLA|not a product SLA/i);
  assert.match(docs, /shadow/i);
  assert.match(docs, /fairness|idempotent|replay|zero second debit/i);
});
