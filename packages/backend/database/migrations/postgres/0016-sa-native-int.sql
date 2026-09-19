CREATE TABLE sa_tenant_capture_policies (
  vpbx_user_uid INTEGER NOT NULL PRIMARY KEY,
  default_enabled BOOLEAN NOT NULL,
  default_project_id VARCHAR(36),
  pause_new BOOLEAN NOT NULL,
  revision INTEGER NOT NULL,
  updated_by INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sa_recording_relations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  recording_id VARCHAR(36) NOT NULL,
  source_kind VARCHAR(32) NOT NULL,
  source_id VARCHAR(64) NOT NULL,
  linkedid VARCHAR(64),
  node_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_sa_rel_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_sa_rel_origin UNIQUE (vpbx_user_uid, source_kind, source_id, recording_id),
  CONSTRAINT chk_sa_rel_kind CHECK (source_kind IN ('cdr','callcenter','autodial','external')),
  CONSTRAINT fk_sa_rel_recording FOREIGN KEY (vpbx_user_uid, recording_id)
    REFERENCES sa_recordings (vpbx_user_uid, id)
);
