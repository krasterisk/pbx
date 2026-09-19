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
  throw new Error('Usage: node harness/database/run-vr-met.cjs [mysql|postgres]');
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  const postgres = dialect === 'postgres';
  test(`${dialect}: VR1/MET1 uniqueness and CHECKs (${images[dialect]})`, { timeout: 300000 }, async t => {
    const password = crypto.randomBytes(24).toString('hex');
    const dbPort = postgres ? 5432 : 3306;
    const db = await new GenericContainer(images[dialect])
      .withEnvironment(postgres
        ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_vr_met' }
        : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_vr_met' })
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
      DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password, DB_NAME: 'krasterisk_vr_met',
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
    const version = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2001';
    const depInternal = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2002';
    const depSip = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2003';
    const session = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2004';
    const project = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2101';
    const pversion = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2102';
    const asset = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2103';
    const rec = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2104';
    const job = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2105';
    const job2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2106';
    const run = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2107';
    const run2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2108';
    const def = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2109';
    const rev = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2110';
    const tx = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2111';

    await t.test('voice version uniqueness and sip cannot be ready', async () => {
      await adapter.query(`INSERT INTO cc_ai_agents
        (uid, name, unique_id, mode, voice, greeting, instruction, channel_kind, enabled, created_at, updated_at, vpbx_user_uid)
        VALUES (9, 'Pilot', 'pilot', 'cascade', '', '', '', 'local', ${enabled}, ${now}, ${now}, 8)`);
      await adapter.query(`INSERT INTO ai_robot_drafts
        (vpbx_user_uid, agent_uid, robot_uuid, draft_revision, runtime_policy, created_at, updated_at)
        VALUES (8, 9, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2099', 1, '{}', ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_robot_versions
        (id, vpbx_user_uid, agent_uid, version_no, config_digest, config, llm_revision_id, created_by, created_at)
        VALUES ('${version}', 8, 9, 1, ${hash}, '{}', 'llm', 7, ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_robot_versions
        (id, vpbx_user_uid, agent_uid, version_no, config_digest, config, llm_revision_id, created_by, created_at)
        VALUES ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2098', 8, 9, 1, ${hash}, '{}', 'llm', 7, ${now})`));
      await adapter.query(`INSERT INTO ai_robot_deployments
        (id, vpbx_user_uid, agent_uid, kind, active_version_id, status, revision, capture_policy, fallback_policy, created_at, updated_at)
        VALUES ('${depInternal}', 8, 9, 'internal', '${version}', 'disabled', 1, '{}', '{}', ${now}, ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_robot_deployments
        (id, vpbx_user_uid, agent_uid, kind, active_version_id, status, revision, capture_policy, fallback_policy, created_at, updated_at)
        VALUES ('${depSip}', 8, 9, 'external_sip', '${version}', 'ready', 1, '{}', '{}', ${now}, ${now})`));
      await adapter.query(`INSERT INTO ai_robot_deployments
        (id, vpbx_user_uid, agent_uid, kind, active_version_id, status, revision, capture_policy, fallback_policy, created_at, updated_at)
        VALUES ('${depSip}', 8, 9, 'external_sip', '${version}', 'disabled', 1, '{}', '{}', ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_voice_sessions
        (id, vpbx_user_uid, deployment_id, version_id, ingress_kind, ingress_key, node_id, owner, fence, state, started_at)
        VALUES ('${session}', 8, '${depInternal}', '${version}', 'native', 'ch-1', 'n1', 'ai-voice', 1, 'admitted', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_voice_sessions
        (id, vpbx_user_uid, deployment_id, version_id, ingress_kind, ingress_key, node_id, owner, fence, state, started_at)
        VALUES ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2097', 8, '${depInternal}', '${version}', 'native', 'ch-1', 'n1', 'ai-voice', 1, 'admitted', ${now})`));
      await adapter.query(`INSERT INTO ai_voice_turns
        (id, vpbx_user_uid, session_id, input_turn_id, output_epoch, role, state, text, provenance, started_ms)
        VALUES ('turn-1', 8, '${session}', 0, 0, 'assistant', 'final', 'hi', 'generated', 0)`);
      await assert.rejects(adapter.query(`INSERT INTO ai_voice_turns
        (id, vpbx_user_uid, session_id, input_turn_id, output_epoch, role, state, text, provenance, started_ms)
        VALUES ('turn-2', 8, '${session}', 0, 0, 'assistant', 'final', 'hi', 'generated', 0)`));
      await adapter.query(`INSERT INTO ai_voice_events
        (id, vpbx_user_uid, session_id, sequence, type, payload, created_at)
        VALUES ('evt-1', 8, '${session}', 1, 'admitted', '{}', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_voice_events
        (id, vpbx_user_uid, session_id, sequence, type, payload, created_at)
        VALUES ('evt-2', 8, '${session}', 1, 'admitted', '{}', ${now})`));
      await adapter.query(`INSERT INTO ai_call_control_operations
        (id, vpbx_user_uid, session_id, operation_key, action, state, created_at)
        VALUES ('op-1', 8, '${session}', 'end-1', 'end_call', 'requested', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO ai_call_control_operations
        (id, vpbx_user_uid, session_id, operation_key, action, state, created_at)
        VALUES ('op-2', 8, '${session}', 'end-1', 'end_call', 'requested', ${now})`));
    });

    await t.test('metric uniqueness, weight check and reanalysis child run', async () => {
      await adapter.query(`INSERT INTO sa_projects
        (id, vpbx_user_uid, name, status, draft_revision, draft_config, created_by, created_at, updated_at)
        VALUES ('${project}', 8, 'Pilot', 'active', 1, '{}', 7, ${now}, ${now})`);
      await adapter.query(`INSERT INTO sa_project_versions
        (id, vpbx_user_uid, project_id, version_no, config_digest, config, stt_revision_id, llm_revision_id, created_by, created_at)
        VALUES ('${pversion}', 8, '${project}', 1, ${hash}, '{}', 'stt', 'llm', 7, ${now})`);
      await adapter.query(`INSERT INTO ai_media_assets
        (id, vpbx_user_uid, source_kind, storage_key, state, sha256, bytes, media_metadata, version, created_at, updated_at)
        VALUES ('${asset}', 8, 'upload', 'krs:v1:local:8:${asset}', 'ready', ${hash}, 12, '{}', 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO sa_recordings
        (id, vpbx_user_uid, project_id, integration_principal_id, external_call_id, source_part, business_key_hash, asset_id, metadata, content_digest, occurred_at, created_at)
        VALUES ('${rec}', 8, '${project}', 'prin-1', 'call-1', 'main', ${hash}, '${asset}', '{}', ${hash}, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_jobs
        (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
        VALUES ('${job}', 8, 'speech_analytics', 'analyze', 'project', '${project}', 'queued', 0, ${now}, 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO ai_jobs
        (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
        VALUES ('${job2}', 8, 'speech_analytics', 'reanalyze', 'project', '${project}', 'queued', 0, ${now}, 1, ${now}, ${now})`);
      await adapter.query(`INSERT INTO sa_analysis_runs
        (id, vpbx_user_uid, recording_id, project_version_id, job_id, state, created_at, updated_at)
        VALUES ('${run}', 8, '${rec}', '${pversion}', '${job}', 'completed', ${now}, ${now})`);
      await adapter.query(`INSERT INTO sa_analysis_runs
        (id, vpbx_user_uid, recording_id, project_version_id, job_id, state, parent_run_id, reason, created_at, updated_at)
        VALUES ('${run2}', 8, '${rec}', '${pversion}', '${job2}', 'queued', '${run}', 'reanalyze', ${now}, ${now})`);
      await adapter.query(`INSERT INTO sa_metric_definitions
        (id, vpbx_user_uid, project_id, metric_key, created_at)
        VALUES ('${def}', 8, '${project}', 'greeting_present', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO sa_metric_definitions
        (id, vpbx_user_uid, project_id, metric_key, created_at)
        VALUES ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2199', 8, '${project}', 'greeting_present', ${now})`));
      await adapter.query(`INSERT INTO sa_metric_revisions
        (id, vpbx_user_uid, definition_id, revision, schema_digest, rubric, created_at)
        VALUES ('${rev}', 8, '${def}', 1, ${hash}, '{}', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO sa_project_version_metrics
        (vpbx_user_uid, project_version_id, definition_id, metric_revision_id, sort_order, weight)
        VALUES (8, '${pversion}', '${def}', '${rev}', 1, -1)`));
      await adapter.query(`INSERT INTO sa_project_version_metrics
        (vpbx_user_uid, project_version_id, definition_id, metric_revision_id, sort_order, weight)
        VALUES (8, '${pversion}', '${def}', '${rev}', 1, 1)`);
      await adapter.query(`INSERT INTO sa_metric_values
        (id, vpbx_user_uid, run_id, metric_revision_id, status, bool_value, evidence_refs)
        VALUES ('val-1', 8, '${run}', '${rev}', 'scored', ${enabled}, '[]')`);
      await assert.rejects(adapter.query(`INSERT INTO sa_metric_values
        (id, vpbx_user_uid, run_id, metric_revision_id, status, bool_value, evidence_refs)
        VALUES ('val-2', 8, '${run}', '${rev}', 'scored', ${enabled}, '[]')`));
      await adapter.query(`INSERT INTO sa_human_reviews
        (id, vpbx_user_uid, run_id, metric_revision_id, expected_review_revision, value, status, reason, actor_user_id, command_key, created_at)
        VALUES ('rev-1', 8, '${run}', '${rev}', 1, 'true', 'accepted', 'ok', 7, 'cmd-1', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO sa_human_reviews
        (id, vpbx_user_uid, run_id, metric_revision_id, expected_review_revision, value, status, reason, actor_user_id, command_key, created_at)
        VALUES ('rev-2', 8, '${run}', '${rev}', 1, 'true', 'accepted', 'ok', 7, 'cmd-1', ${now})`));
      await adapter.query(`INSERT INTO sa_transcripts
        (id, vpbx_user_uid, asset_id, stt_revision_id, content_digest, coverage, created_at)
        VALUES ('${tx}', 8, '${asset}', 'stt', ${hash}, '{}', ${now})`);
      await adapter.query(`INSERT INTO sa_transcript_corrections
        (id, vpbx_user_uid, transcript_id, revision, text, author_user_id, reason, created_at)
        VALUES ('corr-1', 8, '${tx}', 1, 'hello', 7, 'fix', ${now})`);
      await assert.rejects(adapter.query(`INSERT INTO sa_transcript_corrections
        (id, vpbx_user_uid, transcript_id, revision, text, author_user_id, reason, created_at)
        VALUES ('corr-2', 8, '${tx}', 1, 'hello', 7, 'fix', ${now})`));
    });
  });
}
