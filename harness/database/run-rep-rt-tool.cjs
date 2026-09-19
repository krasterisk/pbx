'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { runMigrations, loadMigrations } = require('../../packages/backend/database/migration-runner.cjs');
const images = require('./images.json');

const selected = process.argv.slice(2).filter(value => ['mysql', 'postgres'].includes(value));
if (process.argv.slice(2).some(value => !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-rep-rt-tool.cjs [mysql|postgres]');
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  const postgres = dialect === 'postgres';
  test(`${dialect}: REP/INT/RT/TOOL uniqueness (${images[dialect]})`, { timeout: 300000 }, async t => {
    const password = crypto.randomBytes(24).toString('hex');
    const dbPort = postgres ? 5432 : 3306;
    const db = await new GenericContainer(images[dialect])
      .withEnvironment(postgres
        ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_rep_rt' }
        : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_rep_rt' })
      .withExposedPorts(dbPort)
      .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
      .withStartupTimeout(180000)
      .start();
    let adapter;
    t.after(async () => {
      try { if (adapter) await adapter.close(); } finally { await db.stop(); }
    });
    const environment = {
      DB_DIALECT: dialect, DB_HOST: db.getHost(), DB_PORT: String(db.getMappedPort(dbPort)),
      DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password, DB_NAME: 'krasterisk_rep_rt',
    };
    const config = resolveDatabaseConfig(environment, { requireExplicitConnection: true });
    const deadline = performance.now() + 60000;
    for (;;) {
      try { adapter = await connectAdapter(config); break; }
      catch (error) {
        if (performance.now() >= deadline) throw error;
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
    await runMigrations({
      config, migrations: loadMigrations(dialect, 'analytics-api'), profile: 'analytics-api',
    });
    const now = 'CURRENT_TIMESTAMP';
    const hash = `'${'ab'.repeat(32)}'`;
    const enabled = postgres ? 'TRUE' : '1';
    const off = postgres ? 'FALSE' : '0';
    const project = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4001';
    const rec = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4002';
    const asset = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4003';
    const def = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4004';
    const run = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4005';
    const conn = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4006';
    const dep = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4007';
    const version = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4008';
    const biz = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4009';
    const tool = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4010';
    const base = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4011';

    await t.test('report slot unique, budget and capture policy', async () => {
      await adapter.query(`INSERT INTO sa_projects
        (id, vpbx_user_uid, name, status, draft_revision, draft_config, created_by, created_at, updated_at)
        VALUES ('${project}', 8, 'Pilot', 'active', 1, '{}', 7, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_media_assets
        (id, vpbx_user_uid, source_kind, storage_key, state, sha256, bytes, media_metadata, version, created_at, updated_at)
        VALUES ('${asset}', 8, 'upload', 'krs:v1:local:8:${asset}', 'ready', ${hash}, 12, '{}', 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO sa_recordings
        (id, vpbx_user_uid, project_id, integration_principal_id, external_call_id, source_part, business_key_hash, asset_id, metadata, content_digest, occurred_at, created_at)
        VALUES ('${rec}', 8, '${project}', 'prin-1', 'call-1', 'main', ${hash}, '${asset}', '{}', ${hash}, ${now}, ${now})`);
      await adapter.query(`INSERT INTO sa_report_definitions
        (id, vpbx_user_uid, project_id, name, owner_user_id, draft_revision, filter_spec, template, timezone, status, created_at)
        VALUES ('${def}', 8, '${project}', 'Daily', 7, 1, '{}', 'csv', 'Europe/Moscow', 'active', ${now})`);
      await adapter.query(`INSERT INTO sa_report_runs
        (id, vpbx_user_uid, definition_id, slot_key, filter_digest, filter_spec, state, created_at)
        VALUES ('${run}', 8, '${def}', '2026-09-19@1', ${hash}, '{}', 'completed', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO sa_report_runs
        (id, vpbx_user_uid, definition_id, slot_key, filter_digest, filter_spec, state, created_at)
        VALUES ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4099', 8, '${def}', '2026-09-19@1', ${hash}, '{}', 'completed', ${now})`));
      await adapter.query(`INSERT INTO sa_budget_policies
        (vpbx_user_uid, project_id, unit_cap, reserved_units, pause_on_exceed, revision, updated_by, updated_at)
        VALUES (8, '${project}', 10, 0, ${enabled}, 1, 7, ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO sa_budget_policies
        (vpbx_user_uid, project_id, unit_cap, reserved_units, pause_on_exceed, revision, updated_by, updated_at)
        VALUES (8, '${project}', 5, 0, ${enabled}, 1, 7, ${now})`));
      await adapter.query(`INSERT INTO sa_tenant_capture_policies
        (vpbx_user_uid, default_enabled, pause_new, revision, updated_by, updated_at, created_at)
        VALUES (8, ${off}, ${off}, 1, 7, ${now}, ${now})`);
      await adapter.query(`INSERT INTO sa_recording_relations
        (id, vpbx_user_uid, recording_id, source_kind, source_id, created_at)
        VALUES ('rel-1', 8, '${rec}', 'external', 'ext-1', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO sa_recording_relations
        (id, vpbx_user_uid, recording_id, source_kind, source_id, created_at)
        VALUES ('rel-2', 8, '${rec}', 'external', 'ext-1', ${now})`));
    });

    await t.test('sip DID unique and invocation replay key', async () => {
      await adapter.query(`INSERT INTO cc_ai_agents
        (uid, name, unique_id, mode, voice, greeting, instruction, channel_kind, enabled, created_at, updated_at, vpbx_user_uid)
        VALUES (11, 'Pilot', 'pilot-rt', 'cascade', '', '', '', 'local', ${enabled}, ${now}, ${now}, 8)`);
      await adapter.query(`INSERT INTO ai_robot_versions
        (id, vpbx_user_uid, agent_uid, version_no, config_digest, config, llm_revision_id, created_by, created_at)
        VALUES ('${version}', 8, 11, 1, ${hash}, '{}', 'llm', 7, ${now})`);
      await adapter.query(`INSERT INTO ai_robot_deployments
        (id, vpbx_user_uid, agent_uid, kind, status, revision, capture_policy, fallback_policy, created_at, updated_at)
        VALUES ('${dep}', 8, 11, 'internal', 'disabled', 1, '{}', '{}', ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_sip_connections
        (id, vpbx_user_uid, name, status, transport, auth_kind, draft_revision, secret_once_shown, created_at, updated_at)
        VALUES ('${conn}', 8, 'Edge', 'draft', 'tls', 'digest', 1, ${off}, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_sip_did_bindings
        (vpbx_user_uid, connection_id, did, deployment_id, status, created_at)
        VALUES (8, '${conn}', '+79990001122', '${dep}', 'active', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_sip_did_bindings
        (vpbx_user_uid, connection_id, did, deployment_id, status, created_at)
        VALUES (8, '${conn}', '+79990001122', '${dep}', 'active', ${now})`));
      await adapter.query(`INSERT INTO ai_voice_invocations
        (id, vpbx_user_uid, deployment_id, principal, external_call_id, request_hash, status, destination_ref, created_at)
        VALUES ('inv-1', 8, '${dep}', 'user-7', 'ext-call-1', ${hash}, 'accepted', 'approved:queue', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_voice_invocations
        (id, vpbx_user_uid, deployment_id, principal, external_call_id, request_hash, status, destination_ref, created_at)
        VALUES ('inv-2', 8, '${dep}', 'user-7', 'ext-call-1', ${hash}, 'accepted', 'approved:queue', ${now})`));
    });

    await t.test('tool binding and knowledge ACL uniqueness', async () => {
      await adapter.query(`INSERT INTO ai_business_connections
        (id, vpbx_user_uid, name, kind, status, draft_revision, destination, created_at, updated_at)
        VALUES ('${biz}', 8, 'CRM', 'http', 'draft', 1, 'sandbox://crm', ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_tool_revisions
        (id, vpbx_user_uid, connection_id, revision, schema_digest, schema_json, side_effect, created_at)
        VALUES ('${tool}', 8, '${biz}', 1, ${hash}, '{}', 'read', ${now})`);
      await adapter.query(`INSERT INTO ai_robot_tool_bindings
        (vpbx_user_uid, robot_version_id, tool_revision_id, timeout_ms, side_effect_policy, created_at)
        VALUES (8, '${version}', '${tool}', 5000, 'deny_mutate', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_robot_tool_bindings
        (vpbx_user_uid, robot_version_id, tool_revision_id, timeout_ms, side_effect_policy, created_at)
        VALUES (8, '${version}', '${tool}', 5000, 'deny_mutate', ${now})`));
      await adapter.query(`INSERT INTO kb_bases
        (id, vpbx_user_uid, name, status, draft_revision, created_by, created_at, updated_at)
        VALUES ('${base}', 8, 'Pilot KB', 'draft', 1, 7, ${now}, ${now})`);
      await adapter.query(`INSERT INTO kb_access_bindings
        (vpbx_user_uid, base_id, principal_kind, principal_id, permissions, revision, created_at)
        VALUES (8, '${base}', 'robot', '${version}', 'read', 1, ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO kb_access_bindings
        (vpbx_user_uid, base_id, principal_kind, principal_id, permissions, revision, created_at)
        VALUES (8, '${base}', 'robot', '${version}', 'read', 1, ${now})`));
    });
  });
}
