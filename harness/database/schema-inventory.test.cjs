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
  assert.equal(result.counts.additiveModels, 52);
  assert.deepEqual(Object.keys(result.additiveModels).sort(), [
    'ai_call_control_operations',
    'ai_capture_intents', 'ai_capture_node_bindings', 'ai_capture_receipts', 'ai_capture_segments',
    'ai_idempotency', 'ai_integration_audit', 'ai_integration_auth_limits', 'ai_integration_commands',
    'ai_integration_credentials', 'ai_integration_grants', 'ai_integration_principals',
    'ai_job_events', 'ai_job_stages', 'ai_jobs', 'ai_local_license_bindings',
    'ai_local_license_documents', 'ai_media_assets', 'ai_outbox', 'ai_price_revisions',
    'ai_product_activation',
    'ai_provider_operations', 'ai_provider_revisions', 'ai_quota_counters',
    'ai_robot_deployments', 'ai_robot_drafts', 'ai_robot_versions',
    'ai_uploads',
    'ai_usage_events', 'ai_usage_ledger', 'ai_usage_reservations',
    'ai_voice_events', 'ai_voice_sessions', 'ai_voice_tickets', 'ai_voice_turns',
    'ai_webhook_attempts', 'ai_webhook_deliveries', 'ai_webhook_endpoints',
    'sa_analysis_runs', 'sa_human_reviews', 'sa_metric_definitions', 'sa_metric_revisions',
    'sa_metric_values', 'sa_project_members', 'sa_project_version_metrics', 'sa_project_versions',
    'sa_projects', 'sa_recordings', 'sa_results', 'sa_transcript_corrections',
    'sa_transcript_segments', 'sa_transcripts',
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

test('A2/B2/D1/D4/CAP/AN additive models have dual-engine migration ownership', () => {
  const tables = Object.keys(inventory().additiveModels);
  const d1 = [
    'ai_provider_revisions', 'ai_media_assets', 'ai_uploads', 'ai_idempotency',
    'ai_jobs', 'ai_job_stages', 'ai_provider_operations', 'ai_outbox', 'ai_job_events',
  ];
  const d4 = [
    'ai_quota_counters', 'ai_usage_reservations', 'ai_usage_events', 'ai_price_revisions',
    'ai_usage_ledger',
  ];
  const cap = [
    'ai_capture_node_bindings', 'ai_capture_intents', 'ai_capture_segments', 'ai_capture_receipts',
  ];
  const an1 = [
    'sa_projects', 'sa_project_versions', 'sa_project_members', 'sa_recordings',
    'sa_analysis_runs', 'sa_transcripts', 'sa_transcript_segments', 'sa_results',
  ];
  const an4 = ['ai_webhook_endpoints', 'ai_webhook_deliveries', 'ai_webhook_attempts'];
  const vr1 = [
    'ai_robot_drafts', 'ai_robot_versions', 'ai_robot_deployments',
    'ai_voice_sessions', 'ai_voice_turns', 'ai_voice_events',
    'ai_call_control_operations', 'ai_voice_tickets',
  ];
  const met1 = [
    'sa_metric_definitions', 'sa_metric_revisions', 'sa_project_version_metrics',
    'sa_metric_values', 'sa_human_reviews', 'sa_transcript_corrections',
  ];
  for (const dialect of ['', 'postgres/']) {
    for (const [artifact, owned] of [
      ['0004-ai-product-access.sql', tables.filter(table => !table.startsWith('ai_integration_') && !d1.includes(table) && !d4.includes(table) && !cap.includes(table) && !an1.includes(table) && !an4.includes(table) && !vr1.includes(table) && !met1.includes(table))],
      ['0005-ai-integration-credentials.sql', tables.filter(table => table.startsWith('ai_integration_') && table !== 'ai_integration_auth_limits')],
      ['0006-ai-integration-auth-limits.sql', ['ai_integration_auth_limits']],
      ['0008-ai-jobs-assets.sql', d1],
      ['0009-ai-usage.sql', d4],
      ['0010-ai-capture.sql', cap],
      ['0011-speech-analytics.sql', an1],
      ['0012-ai-webhooks.sql', an4],
      ['0013-ai-voice.sql', vr1],
      ['0014-sa-metrics.sql', met1],
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
