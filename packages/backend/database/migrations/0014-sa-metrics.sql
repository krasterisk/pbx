ALTER TABLE sa_analysis_runs DROP INDEX uq_sa_run_initial;

CREATE TABLE sa_metric_definitions (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  metric_key VARCHAR(64) NOT NULL,
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_metric_def_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_sa_metric_def_key (project_id, metric_key),
  CONSTRAINT fk_sa_metric_def_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_metric_revisions (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  definition_id VARCHAR(36) NOT NULL,
  revision INT NOT NULL,
  schema_digest CHAR(64) NOT NULL,
  rubric TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_metric_rev_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_sa_metric_rev (definition_id, revision),
  CONSTRAINT fk_sa_metric_rev_def FOREIGN KEY (vpbx_user_uid, definition_id)
    REFERENCES sa_metric_definitions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_project_version_metrics (
  vpbx_user_uid INT NOT NULL,
  project_version_id VARCHAR(36) NOT NULL,
  definition_id VARCHAR(36) NOT NULL,
  metric_revision_id VARCHAR(36) NOT NULL,
  sort_order INT NOT NULL,
  weight DECIMAL(8,4) NOT NULL,
  PRIMARY KEY (project_version_id, definition_id),
  UNIQUE KEY uq_sa_pvm_tenant (vpbx_user_uid, project_version_id, definition_id),
  CONSTRAINT chk_sa_pvm_weight CHECK (weight >= 0),
  CONSTRAINT fk_sa_pvm_version FOREIGN KEY (vpbx_user_uid, project_version_id)
    REFERENCES sa_project_versions (vpbx_user_uid, id),
  CONSTRAINT fk_sa_pvm_revision FOREIGN KEY (vpbx_user_uid, metric_revision_id)
    REFERENCES sa_metric_revisions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_metric_values (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  run_id VARCHAR(36) NOT NULL,
  metric_revision_id VARCHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL,
  bool_value TINYINT(1) NULL,
  number_value DECIMAL(18,6) NULL,
  enum_value VARCHAR(64) NULL,
  string_value TEXT NULL,
  normalised_score DECIMAL(8,4) NULL,
  evidence_refs TEXT NOT NULL,
  error_code VARCHAR(64) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_metric_value_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_sa_metric_value_run (run_id, metric_revision_id),
  CONSTRAINT chk_sa_metric_value_status CHECK (status IN ('scored','unknown','not_applicable','unscorable')),
  CONSTRAINT fk_sa_metric_value_run FOREIGN KEY (vpbx_user_uid, run_id)
    REFERENCES sa_analysis_runs (vpbx_user_uid, id),
  CONSTRAINT fk_sa_metric_value_rev FOREIGN KEY (vpbx_user_uid, metric_revision_id)
    REFERENCES sa_metric_revisions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_human_reviews (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  run_id VARCHAR(36) NOT NULL,
  metric_revision_id VARCHAR(36) NOT NULL,
  expected_review_revision INT NOT NULL,
  value TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  actor_user_id INT NOT NULL,
  supersedes_id VARCHAR(36) NULL,
  command_key VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_human_review_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_sa_human_review_cmd (vpbx_user_uid, run_id, command_key),
  CONSTRAINT chk_sa_human_review_status CHECK (status IN ('accepted','rejected','cancelled')),
  CONSTRAINT fk_sa_human_review_run FOREIGN KEY (vpbx_user_uid, run_id)
    REFERENCES sa_analysis_runs (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_transcript_corrections (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  transcript_id VARCHAR(36) NOT NULL,
  revision INT NOT NULL,
  text TEXT NOT NULL,
  author_user_id INT NOT NULL,
  reason TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_tx_corr_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_sa_tx_corr_rev (transcript_id, revision),
  CONSTRAINT fk_sa_tx_corr_parent FOREIGN KEY (vpbx_user_uid, transcript_id)
    REFERENCES sa_transcripts (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
