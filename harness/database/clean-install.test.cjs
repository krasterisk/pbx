'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CURRENT_SCHEMA, COMMUNITY_RUNTIME_MODULES, PBX_ONLY, STANDALONE_EXCLUDED,
  assertBinaryMatchesProfile, assertNoLegacySync, cleanInstall, installPlan,
} = require('./clean-install.cjs');

const root = path.resolve(__dirname, '../..');

test('I1 plan pins current schema and keeps 0019 on full-pbx only', () => {
  for (const dialect of ['mysql', 'postgres']) {
    const full = installPlan(dialect, 'full-pbx');
    const analytics = installPlan(dialect, 'analytics-api');
    const robot = installPlan(dialect, 'robot-api');
    assert.equal(full.schemaVersion, CURRENT_SCHEMA);
    assert.equal(analytics.schemaVersion, CURRENT_SCHEMA);
    assert.deepEqual(robot.ids, analytics.ids);
    assert.equal(full.includesPbxOdbc, true);
    assert.equal(analytics.includesPbxOdbc, false);
    assert.ok(full.ids.includes(PBX_ONLY));
    assert.ok(!analytics.ids.includes(PBX_ONLY));
    assert.deepEqual(analytics.standaloneExcluded, [...STANDALONE_EXCLUDED]);
  }
  assert.throws(() => installPlan('sqlite', 'full-pbx'), /DB_DIALECT/);
  assert.throws(() => installPlan('mysql', 'video-api'), /profile is not implemented/);
});

test('wrong binary and rollback refuse before connecting', async () => {
  assert.throws(() => assertBinaryMatchesProfile({
    DB_SCHEMA_PROFILE: 'robot-api', KRASTERISK_BINARY: 'analytics-api',
  }), /matching DB_SCHEMA_PROFILE/);
  assert.throws(() => assertBinaryMatchesProfile({
    DB_SCHEMA_PROFILE: 'analytics-api', KRASTERISK_BINARY: 'community-pbx',
  }), /community binary refuses commercial schema profile/);
  assert.doesNotThrow(() => assertBinaryMatchesProfile({
    DB_SCHEMA_PROFILE: 'full-pbx', KRASTERISK_BINARY: 'community-pbx',
  }));
  await assert.rejects(cleanInstall(['--rollback'], { DB_DIALECT: 'mysql' }), /Automatic rollback/);
  await assert.rejects(cleanInstall(['--plan', '--seed-ci'], {
    DB_DIALECT: 'mysql', DB_SCHEMA_PROFILE: 'analytics-api',
  }), /--seed-ci requires --apply/);
});

test('community composition and installer sources do not require commercial AI tables', () => {
  const community = fs.readFileSync(path.join(root, 'packages/backend/src/compositions/community-pbx.module.ts'), 'utf8');
  const provision = fs.readFileSync(path.join(root, 'packages/backend/src/standalone-provision.main.ts'), 'utf8');
  const sync = fs.readFileSync(path.join(root, 'packages/backend/src/sync.ts'), 'utf8');
  const pbxCore = fs.readFileSync(path.join(root, 'packages/backend/src/compositions/pbx-core.composition.ts'), 'utf8');
  const standalone = fs.readFileSync(path.join(root, 'packages/backend/src/compositions/standalone-ai-core.module.ts'), 'utf8');
  for (const moduleName of COMMUNITY_RUNTIME_MODULES) {
    assert.doesNotMatch(community, new RegExp(`${moduleName}\\.module`));
  }
  assert.match(community, /commercialProductSource: 'absent'/);
  assert.doesNotMatch(provision, /\bAMI\b|\bARI\b|queue_log|ps_endpoints|provisionPbx/);
  assert.match(provision, /standalone-ai/);
  assert.match(sync, /Legacy schema sync is disabled/);
  assertNoLegacySync(pbxCore);
  assertNoLegacySync(standalone);
  assert.match(pbxCore, /synchronize: false/);
  assert.match(standalone, /synchronize: false/);
});

test('--plan is offline and returns the install matrix row', async () => {
  const result = await cleanInstall(['--plan'], {
    DB_DIALECT: 'postgres', DB_SCHEMA_PROFILE: 'analytics-api',
  });
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'plan');
  assert.equal(result.plan.schemaVersion, CURRENT_SCHEMA);
  assert.equal(result.plan.includesPbxOdbc, false);
});
