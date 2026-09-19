CREATE TABLE sa_report_definitions (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  owner_user_id INT NOT NULL,
  draft_revision INT NOT NULL,
  filter_spec TEXT NOT NULL,
  template VARCHAR(32) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_report_def_tenant (vpbx_user_uid, id),
  CONSTRAINT chk_sa_report_def_status CHECK (status IN ('draft','active','paused')),
  CONSTRAINT fk_sa_report_def_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_report_runs (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  definition_id VARCHAR(36) NOT NULL,
  slot_key VARCHAR(64) NOT NULL,
  filter_digest CHAR(64) NOT NULL,
  filter_spec TEXT NOT NULL,
  state VARCHAR(32) NOT NULL,
  job_id VARCHAR(36) NULL,
  artifact_ref TEXT NULL,
  snapshot_hash CHAR(64) NULL,
  expires_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_report_run_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_sa_report_run_slot (definition_id, slot_key),
  CONSTRAINT chk_sa_report_run_state CHECK (state IN ('queued','running','completed','failed','cancelled')),
  CONSTRAINT fk_sa_report_run_def FOREIGN KEY (vpbx_user_uid, definition_id)
    REFERENCES sa_report_definitions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_report_snapshot_items (
  vpbx_user_uid INT NOT NULL,
  run_id VARCHAR(36) NOT NULL,
  recording_id VARCHAR(36) NOT NULL,
  result_id VARCHAR(36) NULL,
  review_revision INT NOT NULL,
  projected TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (run_id, recording_id),
  UNIQUE KEY uq_sa_report_snap_tenant (vpbx_user_uid, run_id, recording_id),
  CONSTRAINT fk_sa_report_snap_run FOREIGN KEY (vpbx_user_uid, run_id)
    REFERENCES sa_report_runs (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_report_schedules (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  definition_id VARCHAR(36) NOT NULL,
  cadence VARCHAR(16) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  next_slot VARCHAR(32) NOT NULL,
  revision INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  recipients TEXT NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_report_sched_tenant (vpbx_user_uid, id),
  CONSTRAINT chk_sa_report_sched_cadence CHECK (cadence IN ('daily','weekly')),
  CONSTRAINT chk_sa_report_sched_status CHECK (status IN ('active','paused')),
  CONSTRAINT fk_sa_report_sched_def FOREIGN KEY (vpbx_user_uid, definition_id)
    REFERENCES sa_report_definitions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_budget_policies (
  vpbx_user_uid INT NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  unit_cap INT NOT NULL,
  reserved_units INT NOT NULL,
  pause_on_exceed TINYINT(1) NOT NULL,
  revision INT NOT NULL,
  updated_by INT NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (vpbx_user_uid, project_id),
  CONSTRAINT chk_sa_budget_cap CHECK (unit_cap >= 0 AND reserved_units >= 0),
  CONSTRAINT fk_sa_budget_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_bulk_reanalysis_batches (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  selection_digest CHAR(64) NOT NULL,
  item_count INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_bulk_batch_tenant (vpbx_user_uid, id),
  CONSTRAINT chk_sa_bulk_batch_status CHECK (status IN ('pending','running','completed','cancelled')),
  CONSTRAINT chk_sa_bulk_batch_count CHECK (item_count >= 0 AND item_count <= 1000),
  CONSTRAINT fk_sa_bulk_batch_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_bulk_reanalysis_items (
  vpbx_user_uid INT NOT NULL,
  batch_id VARCHAR(36) NOT NULL,
  recording_id VARCHAR(36) NOT NULL,
  job_id VARCHAR(36) NULL,
  status VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  PRIMARY KEY (batch_id, recording_id),
  UNIQUE KEY uq_sa_bulk_item_tenant (vpbx_user_uid, batch_id, recording_id),
  CONSTRAINT chk_sa_bulk_item_status CHECK (status IN ('accepted','running','succeeded','failed','skipped')),
  CONSTRAINT fk_sa_bulk_item_batch FOREIGN KEY (vpbx_user_uid, batch_id)
    REFERENCES sa_bulk_reanalysis_batches (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
