'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CURRENT_SCHEMA, UPGRADE_STEPS, n1Schema, upgradePlan, mayAdmitTraffic, upgrade,
} = require('./upgrade.cjs');
const { installPlan } = require('./clean-install.cjs');

test('N-1 is 0019 on full-pbx and 0018 on standalone; empty 0001→current stays I1', () => {
  for (const dialect of ['mysql', 'postgres']) {
    assert.equal(n1Schema(dialect, 'full-pbx'), '0019-asterisk-odbc.sql');
    assert.equal(n1Schema(dialect, 'analytics-api'), '0018-ai-tools.sql');
    assert.equal(n1Schema(dialect, 'robot-api'), '0018-ai-tools.sql');
    assert.equal(installPlan(dialect, 'analytics-api').schemaVersion, CURRENT_SCHEMA);
    const plan = upgradePlan(dialect, 'analytics-api');
    assert.deepEqual(plan.steps, [...UPGRADE_STEPS]);
    assert.equal(plan.to, CURRENT_SCHEMA);
    assert.match(plan.emptyInstallBaseline, /I1/);
  }
});

test('upgrade refuses rollback and does not auto-admit before drain', async () => {
  await assert.rejects(upgrade(['--rollback'], { DB_DIALECT: 'mysql' }), /Automatic rollback/);
  assert.throws(() => mayAdmitTraffic({
    schemaReady: true, drained: false, workersReady: true,
  }), /drain before admitting/);
  assert.throws(() => mayAdmitTraffic({
    schemaReady: false, drained: true, workersReady: true,
  }), /schema not ready/);
  assert.deepEqual(mayAdmitTraffic({
    schemaReady: true, drained: true, workersReady: true,
  }), { admitted: true });
});

test('--plan is offline and names backup then migrate then drain', async () => {
  const result = await upgrade(['--plan'], {
    DB_DIALECT: 'postgres', DB_SCHEMA_PROFILE: 'full-pbx',
  });
  assert.equal(result.ok, true);
  assert.equal(result.plan.from, '0019-asterisk-odbc.sql');
  assert.equal(result.plan.to, CURRENT_SCHEMA);
  assert.deepEqual(result.plan.steps, [
    'backup', 'migrate', 'health/schema readiness', 'worker drain', 'admit traffic',
  ]);
  assert.match(result.plan.recovery, /rollback is not supported/);
});
