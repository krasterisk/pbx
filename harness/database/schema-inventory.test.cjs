'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inventory, splitTopLevel } = require('./schema-inventory.cjs');
const { draft } = require('./draft-postgres-baseline.cjs');

test('baseline and AppModule model table/column names stay in sync', () => {
  const result = inventory();
  assert.equal(result.sources.baselineSha256, '8c18e47d94da3c3aeca3807eb44dbd0280433c1dedf96bef36470203d699543d');
  // This pins all class/member decorators, declared TS types and their names,
  // including defaults, unique/index/association actions and identity metadata.
  // DB-02-B: User timestamps=true makes Sequelize populate existing NOT NULL columns.
  assert.equal(result.sources.modelMetadataSha256, '1aa7a2ac56ad8b01414fafc19b25dfa96ff138d4da000724070da775a705a797');
  assert.equal(result.counts.models, result.counts.baselineTables);
  assert.equal(result.counts.additiveModels, 23);
  assert.deepEqual(Object.keys(result.additiveModels).sort(), [
    'ai_idempotency', 'ai_integration_audit', 'ai_integration_auth_limits', 'ai_integration_commands',
    'ai_integration_credentials', 'ai_integration_grants', 'ai_integration_principals',
    'ai_job_events', 'ai_job_stages', 'ai_jobs', 'ai_local_license_bindings',
    'ai_local_license_documents', 'ai_media_assets', 'ai_outbox', 'ai_price_revisions',
    'ai_product_activation',
    'ai_provider_operations', 'ai_provider_revisions', 'ai_quota_counters', 'ai_uploads',
    'ai_usage_events', 'ai_usage_ledger', 'ai_usage_reservations',
  ]);
  assert.equal(result.counts.modelColumns, result.counts.baselineColumns);
  assert.deepEqual(result.differences, {
    modelTablesAbsentFromBaseline: [], baselineTablesAbsentFromModels: [],
    modelColumnsAbsentFromBaseline: [], baselineColumnsAbsentFromModels: [],
    typeDifferences: [],
    intentionalTypeWidenings: result.differences.intentionalTypeWidenings,
    nullabilityDifferences: [],
  });
  assert.equal(result.differences.intentionalTypeWidenings.length, 99);
  assert.ok(result.differences.intentionalTypeWidenings.every(row => row.startsWith('ps_endpoints.') && row.endsWith('model=VARCHAR(40) baseline=TEXT')));
});

test('A2/B2/D1/D4 additive models have dual-engine migration ownership', () => {
  const tables = Object.keys(inventory().additiveModels);
  const d1 = [
    'ai_provider_revisions', 'ai_media_assets', 'ai_uploads', 'ai_idempotency',
    'ai_jobs', 'ai_job_stages', 'ai_provider_operations', 'ai_outbox', 'ai_job_events',
  ];
  const d4 = [
    'ai_quota_counters', 'ai_usage_reservations', 'ai_usage_events', 'ai_price_revisions',
    'ai_usage_ledger',
  ];
  for (const dialect of ['', 'postgres/']) {
    for (const [artifact, owned] of [
      ['0004-ai-product-access.sql', tables.filter(table => !table.startsWith('ai_integration_') && !d1.includes(table) && !d4.includes(table))],
      ['0005-ai-integration-credentials.sql', tables.filter(table => table.startsWith('ai_integration_') && table !== 'ai_integration_auth_limits')],
      ['0006-ai-integration-auth-limits.sql', ['ai_integration_auth_limits']],
      ['0008-ai-jobs-assets.sql', d1],
      ['0009-ai-usage.sql', d4],
    ]) {
      const sql = fs.readFileSync(path.resolve(__dirname,
        `../../packages/backend/database/migrations/${dialect}${artifact}`), 'utf8');
      for (const table of owned) assert.match(sql, new RegExp(`CREATE TABLE ${table} \\(`));
    }
  }
});

for (const [filename, before, after] of [
  ['ai-agent.model.ts', "defaultValue: 'realtime'", "defaultValue: 'cascade'"],
  ['cloud-setting.model.ts', 'unique: true', 'unique: false'],
]) {
  test(`schema metadata drift catches ${filename}: ${before}`, () => {
    const original = fs.readFileSync;
    let replaced = false;
    fs.readFileSync = function (file, ...args) {
      const result = original.call(this, file, ...args);
      if (String(file).endsWith(filename) && typeof result === 'string' && result.includes(before)) {
        replaced = true;
        return result.replace(before, after);
      }
      return result;
    };
    try {
      const changed = inventory();
      assert.equal(replaced, true);
      assert.notEqual(changed.sources.modelMetadataSha256, '1aa7a2ac56ad8b01414fafc19b25dfa96ff138d4da000724070da775a705a797');
    } finally { fs.readFileSync = original; }
  });
}

test('schema fingerprint is independent of CRLF/LF checkout', () => {
  const original = fs.readFileSync;
  let normalized = false;
  fs.readFileSync = function (file, ...args) {
    const result = original.call(this, file, ...args);
    if (String(file).endsWith('ai-agent.model.ts') && typeof result === 'string') {
      normalized = true;
      return result.replace(/\r\n/g, '\n');
    }
    return result;
  };
  try {
    const changed = inventory();
    assert.equal(normalized, true);
    assert.equal(changed.sources.modelMetadataSha256, '1aa7a2ac56ad8b01414fafc19b25dfa96ff138d4da000724070da775a705a797');
  } finally { fs.readFileSync = original; }
});

test('SQL inventory splitter preserves quoted commas and nested type lists', () => {
  assert.deepEqual(splitTopLevel("`value` ENUM('one,two', 'three'), `price` DECIMAL(14,4), PRIMARY KEY (`id`)"), [
    "`value` ENUM('one,two', 'three')", '`price` DECIMAL(14,4)', 'PRIMARY KEY (`id`)',
  ]);
});

test('reviewed PostgreSQL baseline matches the pinned offline schema translation', () => {
  const file = path.resolve(__dirname, '../../packages/backend/database/migrations/postgres/0001-current-schema.sql');
  const sql = fs.readFileSync(file, 'utf8');
  assert.equal(sql, draft());
  assert.doesNotMatch(sql, /FOREIGN_KEY_CHECKS|ENGINE=InnoDB|auto_increment|TINYINT\(1\)/i);
});
