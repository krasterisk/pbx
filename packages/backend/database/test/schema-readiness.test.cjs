'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertReady } = require('../../src/database/schema-readiness.cjs');
const { assertDisposable } = require('../seed-ci.cjs');

const migrations = [{ id: '0001-current-schema.sql' }];
const ready = {
  engine: 'postgres', historyState: 'versioned', schemaVersion: migrations[0].id,
  pending: [], dirty: null,
};

test('startup accepts only the selected, complete and clean migration history', () => {
  assert.deepEqual(assertReady(ready, migrations, 'postgres'), { engine: 'postgres', schemaVersion: migrations[0].id });
  assert.throws(() => assertReady({ ...ready, engine: 'mysql' }, migrations, 'postgres'), /engine mismatch/);
  assert.throws(() => assertReady({ ...ready, historyState: 'legacy' }, migrations, 'postgres'), /unversioned/);
  assert.throws(() => assertReady({ ...ready, dirty: { name: migrations[0].id } }, migrations, 'postgres'), /interrupted/);
  assert.throws(() => assertReady({ ...ready, schemaVersion: null, pending: [migrations[0].id] }, migrations, 'postgres'), /expected/);
  assert.throws(() => assertReady({ ...ready, profile: 'analytics-api' }, migrations, 'postgres'), /profile mismatch/);
  assert.throws(() => assertReady({ ...ready, profileState: 'legacy-full-pbx' }, migrations, 'postgres'), /profile_upgrade_required/);
});

test('CI seed refuses non-disposable targets and missing password before connecting', () => {
  const valid = { CI: 'true', DB_NAME: 'krasterisk_ci_seed', CI_SEED_PASSWORD: 'long-test-only-password' };
  assert.doesNotThrow(() => assertDisposable(valid));
  assert.throws(() => assertDisposable({ ...valid, DB_NAME: 'krasterisk' }), /CI fixture/);
  assert.throws(() => assertDisposable({ ...valid, CI: 'false' }), /CI fixture/);
  assert.throws(() => assertDisposable({ ...valid, CI_SEED_PASSWORD: '' }), /CI_SEED_PASSWORD/);
});
