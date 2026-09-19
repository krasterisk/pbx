CREATE TABLE sa_projects (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  draft_revision INT NOT NULL,
  draft_config TEXT NOT NULL,
  active_version_id VARCHAR(36) NULL,
  created_by INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_project_tenant (vpbx_user_uid, id),
  CONSTRAINT chk_sa_project_status CHECK (status IN ('draft','active','archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_project_versions (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  version_no INT NOT NULL,
  config_digest CHAR(64) NOT NULL,
  config TEXT NOT NULL,
  stt_revision_id VARCHAR(36) NOT NULL,
  llm_revision_id VARCHAR(36) NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_project_version_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_sa_project_version_no (project_id, version_no),
  CONSTRAINT fk_sa_project_version_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_project_members (
  vpbx_user_uid INT NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(32) NOT NULL,
  can_audio TINYINT(1) NOT NULL,
  can_transcript TINYINT(1) NOT NULL,
  PRIMARY KEY (project_id, user_id),
  UNIQUE KEY uq_sa_project_member_tenant (vpbx_user_uid, project_id, user_id),
  CONSTRAINT chk_sa_project_member_role CHECK (role IN ('owner','analyst','viewer')),
  CONSTRAINT fk_sa_project_member_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_recordings (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  integration_principal_id VARCHAR(36) NOT NULL,
  external_call_id VARCHAR(128) NOT NULL,
  source_part VARCHAR(64) NOT NULL,
  business_key_hash CHAR(64) NOT NULL,
  asset_id VARCHAR(36) NOT NULL,
  metadata TEXT NOT NULL,
  content_digest CHAR(64) NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_recording_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_sa_recording_business (vpbx_user_uid, project_id, integration_principal_id, business_key_hash),
  CONSTRAINT fk_sa_recording_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id),
  CONSTRAINT fk_sa_recording_asset FOREIGN KEY (vpbx_user_uid, asset_id)
    REFERENCES ai_media_assets (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_analysis_runs (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  recording_id VARCHAR(36) NOT NULL,
  project_version_id VARCHAR(36) NOT NULL,
  job_id VARCHAR(36) NOT NULL,
  state VARCHAR(32) NOT NULL,
  transcript_id VARCHAR(36) NULL,
  result_id VARCHAR(36) NULL,
  parent_run_id VARCHAR(36) NULL,
  reason VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_run_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_sa_run_job (job_id),
  UNIQUE KEY uq_sa_run_initial (recording_id),
  KEY idx_sa_run_tenant_state (vpbx_user_uid, state, created_at, id),
  CONSTRAINT chk_sa_run_state CHECK (state IN (
    'queued','running','retry_wait','awaiting_reconciliation','partial','completed','failed','cancelled')),
  CONSTRAINT fk_sa_run_recording FOREIGN KEY (vpbx_user_uid, recording_id)
    REFERENCES sa_recordings (vpbx_user_uid, id),
  CONSTRAINT fk_sa_run_version FOREIGN KEY (vpbx_user_uid, project_version_id)
    REFERENCES sa_project_versions (vpbx_user_uid, id),
  CONSTRAINT fk_sa_run_job FOREIGN KEY (vpbx_user_uid, job_id)
    REFERENCES ai_jobs (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_transcripts (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  asset_id VARCHAR(36) NOT NULL,
  stt_revision_id VARCHAR(36) NOT NULL,
  content_digest CHAR(64) NOT NULL,
  coverage TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_transcript_tenant (vpbx_user_uid, id),
  CONSTRAINT fk_sa_transcript_asset FOREIGN KEY (vpbx_user_uid, asset_id)
    REFERENCES ai_media_assets (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_transcript_segments (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  transcript_id VARCHAR(36) NOT NULL,
  ordinal INT NOT NULL,
  start_ms BIGINT NOT NULL,
  end_ms BIGINT NOT NULL,
  channel INT NOT NULL,
  speaker_role VARCHAR(32) NOT NULL,
  role_source VARCHAR(32) NOT NULL,
  text TEXT NOT NULL,
  confidence DECIMAL(6,5) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_transcript_segment_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_sa_transcript_segment_ordinal (transcript_id, ordinal),
  CONSTRAINT fk_sa_transcript_segment_parent FOREIGN KEY (vpbx_user_uid, transcript_id)
    REFERENCES sa_transcripts (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_results (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  run_id VARCHAR(36) NOT NULL,
  version INT NOT NULL,
  schema_version INT NOT NULL,
  summary TEXT NOT NULL,
  metric_results TEXT NOT NULL,
  evidence_refs TEXT NOT NULL,
  quality VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_result_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_sa_result_run_version (run_id, version),
  CONSTRAINT chk_sa_result_status CHECK (status IN ('completed','partial','failed','unscorable')),
  CONSTRAINT fk_sa_result_run FOREIGN KEY (vpbx_user_uid, run_id)
    REFERENCES sa_analysis_runs (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
