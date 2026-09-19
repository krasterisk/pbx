ALTER TABLE sa_analysis_runs DROP CONSTRAINT IF EXISTS uq_sa_run_initial;

CREATE TABLE sa_metric_definitions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  metric_key VARCHAR(64) NOT NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_sa_metric_def_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_sa_metric_def_key UNIQUE (project_id, metric_key),
  CONSTRAINT fk_sa_metric_def_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
);

CREATE TABLE sa_metric_revisions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  definition_id VARCHAR(36) NOT NULL,
  revision INTEGER NOT NULL,
  schema_digest CHAR(64) NOT NULL,
  rubric TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_sa_metric_rev_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_sa_metric_rev UNIQUE (definition_id, revision),
  CONSTRAINT fk_sa_metric_rev_def FOREIGN KEY (vpbx_user_uid, definition_id)
    REFERENCES sa_metric_definitions (vpbx_user_uid, id)
);

CREATE TABLE sa_project_version_metrics (
  vpbx_user_uid INTEGER NOT NULL,
  project_version_id VARCHAR(36) NOT NULL,
  definition_id VARCHAR(36) NOT NULL,
  metric_revision_id VARCHAR(36) NOT NULL,
  sort_order INTEGER NOT NULL,
  weight NUMERIC(8,4) NOT NULL,
  PRIMARY KEY (project_version_id, definition_id),
  CONSTRAINT uq_sa_pvm_tenant UNIQUE (vpbx_user_uid, project_version_id, definition_id),
  CONSTRAINT chk_sa_pvm_weight CHECK (weight >= 0),
  CONSTRAINT fk_sa_pvm_version FOREIGN KEY (vpbx_user_uid, project_version_id)
    REFERENCES sa_project_versions (vpbx_user_uid, id),
  CONSTRAINT fk_sa_pvm_revision FOREIGN KEY (vpbx_user_uid, metric_revision_id)
    REFERENCES sa_metric_revisions (vpbx_user_uid, id)
);

CREATE TABLE sa_metric_values (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  run_id VARCHAR(36) NOT NULL,
  metric_revision_id VARCHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL,
  bool_value BOOLEAN,
  number_value NUMERIC(18,6),
  enum_value VARCHAR(64),
  string_value TEXT,
  normalised_score NUMERIC(8,4),
  evidence_refs TEXT NOT NULL,
  error_code VARCHAR(64),
  CONSTRAINT uq_sa_metric_value_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_sa_metric_value_run UNIQUE (run_id, metric_revision_id),
  CONSTRAINT chk_sa_metric_value_status CHECK (status IN ('scored','unknown','not_applicable','unscorable')),
  CONSTRAINT fk_sa_metric_value_run FOREIGN KEY (vpbx_user_uid, run_id)
    REFERENCES sa_analysis_runs (vpbx_user_uid, id),
  CONSTRAINT fk_sa_metric_value_rev FOREIGN KEY (vpbx_user_uid, metric_revision_id)
    REFERENCES sa_metric_revisions (vpbx_user_uid, id)
);

CREATE TABLE sa_human_reviews (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  run_id VARCHAR(36) NOT NULL,
  metric_revision_id VARCHAR(36) NOT NULL,
  expected_review_revision INTEGER NOT NULL,
  value TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  actor_user_id INTEGER NOT NULL,
  supersedes_id VARCHAR(36),
  command_key VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_sa_human_review_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_sa_human_review_cmd UNIQUE (vpbx_user_uid, run_id, command_key),
  CONSTRAINT chk_sa_human_review_status CHECK (status IN ('accepted','rejected','cancelled')),
  CONSTRAINT fk_sa_human_review_run FOREIGN KEY (vpbx_user_uid, run_id)
    REFERENCES sa_analysis_runs (vpbx_user_uid, id)
);

CREATE TABLE sa_transcript_corrections (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  transcript_id VARCHAR(36) NOT NULL,
  revision INTEGER NOT NULL,
  text TEXT NOT NULL,
  author_user_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_sa_tx_corr_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_sa_tx_corr_rev UNIQUE (transcript_id, revision),
  CONSTRAINT fk_sa_tx_corr_parent FOREIGN KEY (vpbx_user_uid, transcript_id)
    REFERENCES sa_transcripts (vpbx_user_uid, id)
);
