CREATE TABLE sa_projects (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  draft_revision INTEGER NOT NULL,
  draft_config TEXT NOT NULL,
  active_version_id VARCHAR(36),
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_sa_project_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT chk_sa_project_status CHECK (status IN ('draft','active','archived'))
);

CREATE TABLE sa_project_versions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  version_no INTEGER NOT NULL,
  config_digest CHAR(64) NOT NULL,
  config TEXT NOT NULL,
  stt_revision_id VARCHAR(36) NOT NULL,
  llm_revision_id VARCHAR(36) NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_sa_project_version_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_sa_project_version_no UNIQUE (project_id, version_no),
  CONSTRAINT fk_sa_project_version_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
);

CREATE TABLE sa_project_members (
  vpbx_user_uid INTEGER NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  user_id INTEGER NOT NULL,
  role VARCHAR(32) NOT NULL,
  can_audio BOOLEAN NOT NULL,
  can_transcript BOOLEAN NOT NULL,
  PRIMARY KEY (project_id, user_id),
  CONSTRAINT uq_sa_project_member_tenant UNIQUE (vpbx_user_uid, project_id, user_id),
  CONSTRAINT chk_sa_project_member_role CHECK (role IN ('owner','analyst','viewer')),
  CONSTRAINT fk_sa_project_member_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
);

CREATE TABLE sa_recordings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  integration_principal_id VARCHAR(36) NOT NULL,
  external_call_id VARCHAR(128) NOT NULL,
  source_part VARCHAR(64) NOT NULL,
  business_key_hash CHAR(64) NOT NULL,
  asset_id VARCHAR(36) NOT NULL,
  metadata TEXT NOT NULL,
  content_digest CHAR(64) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_sa_recording_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_sa_recording_business UNIQUE (vpbx_user_uid, project_id, integration_principal_id, business_key_hash),
  CONSTRAINT fk_sa_recording_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id),
  CONSTRAINT fk_sa_recording_asset FOREIGN KEY (vpbx_user_uid, asset_id)
    REFERENCES ai_media_assets (vpbx_user_uid, id)
);

CREATE TABLE sa_analysis_runs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  recording_id VARCHAR(36) NOT NULL,
  project_version_id VARCHAR(36) NOT NULL,
  job_id VARCHAR(36) NOT NULL,
  state VARCHAR(32) NOT NULL,
  transcript_id VARCHAR(36),
  result_id VARCHAR(36),
  parent_run_id VARCHAR(36),
  reason VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_sa_run_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_sa_run_job UNIQUE (job_id),
  CONSTRAINT uq_sa_run_initial UNIQUE (recording_id),
  CONSTRAINT chk_sa_run_state CHECK (state IN (
    'queued','running','retry_wait','awaiting_reconciliation','partial','completed','failed','cancelled')),
  CONSTRAINT fk_sa_run_recording FOREIGN KEY (vpbx_user_uid, recording_id)
    REFERENCES sa_recordings (vpbx_user_uid, id),
  CONSTRAINT fk_sa_run_version FOREIGN KEY (vpbx_user_uid, project_version_id)
    REFERENCES sa_project_versions (vpbx_user_uid, id),
  CONSTRAINT fk_sa_run_job FOREIGN KEY (vpbx_user_uid, job_id)
    REFERENCES ai_jobs (vpbx_user_uid, id)
);
CREATE INDEX idx_sa_run_tenant_state ON sa_analysis_runs (vpbx_user_uid, state, created_at, id);

CREATE TABLE sa_transcripts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  asset_id VARCHAR(36) NOT NULL,
  stt_revision_id VARCHAR(36) NOT NULL,
  content_digest CHAR(64) NOT NULL,
  coverage TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_sa_transcript_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT fk_sa_transcript_asset FOREIGN KEY (vpbx_user_uid, asset_id)
    REFERENCES ai_media_assets (vpbx_user_uid, id)
);

CREATE TABLE sa_transcript_segments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  transcript_id VARCHAR(36) NOT NULL,
  ordinal INTEGER NOT NULL,
  start_ms BIGINT NOT NULL,
  end_ms BIGINT NOT NULL,
  channel INTEGER NOT NULL,
  speaker_role VARCHAR(32) NOT NULL,
  role_source VARCHAR(32) NOT NULL,
  text TEXT NOT NULL,
  confidence NUMERIC(6,5),
  CONSTRAINT uq_sa_transcript_segment_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_sa_transcript_segment_ordinal UNIQUE (transcript_id, ordinal),
  CONSTRAINT fk_sa_transcript_segment_parent FOREIGN KEY (vpbx_user_uid, transcript_id)
    REFERENCES sa_transcripts (vpbx_user_uid, id)
);

CREATE TABLE sa_results (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  run_id VARCHAR(36) NOT NULL,
  version INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  summary TEXT NOT NULL,
  metric_results TEXT NOT NULL,
  evidence_refs TEXT NOT NULL,
  quality VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_sa_result_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_sa_result_run_version UNIQUE (run_id, version),
  CONSTRAINT chk_sa_result_status CHECK (status IN ('completed','partial','failed','unscorable')),
  CONSTRAINT fk_sa_result_run FOREIGN KEY (vpbx_user_uid, run_id)
    REFERENCES sa_analysis_runs (vpbx_user_uid, id)
);
