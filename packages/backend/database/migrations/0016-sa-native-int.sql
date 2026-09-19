CREATE TABLE sa_tenant_capture_policies (
  vpbx_user_uid INT NOT NULL,
  default_enabled TINYINT(1) NOT NULL,
  default_project_id VARCHAR(36) NULL,
  pause_new TINYINT(1) NOT NULL,
  revision INT NOT NULL,
  updated_by INT NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (vpbx_user_uid),
  CONSTRAINT chk_sa_cap_pol_default CHECK (default_enabled IN (0,1)),
  CONSTRAINT chk_sa_cap_pol_pause CHECK (pause_new IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sa_recording_relations (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  recording_id VARCHAR(36) NOT NULL,
  source_kind VARCHAR(32) NOT NULL,
  source_id VARCHAR(64) NOT NULL,
  linkedid VARCHAR(64) NULL,
  node_id VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_rel_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_sa_rel_origin (vpbx_user_uid, source_kind, source_id, recording_id),
  CONSTRAINT chk_sa_rel_kind CHECK (source_kind IN ('cdr','callcenter','autodial','external')),
  CONSTRAINT fk_sa_rel_recording FOREIGN KEY (vpbx_user_uid, recording_id)
    REFERENCES sa_recordings (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
