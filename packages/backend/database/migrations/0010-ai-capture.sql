CREATE TABLE ai_capture_node_bindings (
  id VARCHAR(36) NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  revision INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  identity_digest CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  config_digest CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_capture_binding_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_capture_binding_node_rev (node_id, revision),
  CONSTRAINT chk_ai_capture_binding_status CHECK (status IN ('active','revoked','expired'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_capture_intents (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  recording_uid VARCHAR(36) NOT NULL,
  origin_kind VARCHAR(32) NOT NULL,
  origin_id VARCHAR(128) NOT NULL,
  recorder_id VARCHAR(64) NOT NULL,
  binding_id VARCHAR(36) NOT NULL,
  binding_revision INT NOT NULL,
  state VARCHAR(32) NOT NULL,
  policy_snapshot TEXT NOT NULL,
  call_ref VARCHAR(128) NULL,
  created_at DATETIME(3) NOT NULL,
  closed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_capture_intent_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_capture_intent_node_recording (node_id, recording_uid),
  KEY idx_ai_capture_intent_tenant_state (vpbx_user_uid, state, created_at),
  CONSTRAINT chk_ai_capture_intent_origin CHECK (origin_kind IN ('pbx_route','robot_session')),
  CONSTRAINT chk_ai_capture_intent_state CHECK (state IN ('open','closed','quarantined','failed')),
  CONSTRAINT fk_ai_capture_intent_binding FOREIGN KEY (vpbx_user_uid, binding_id)
    REFERENCES ai_capture_node_bindings (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_capture_segments (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  intent_id VARCHAR(36) NOT NULL,
  ordinal INT NOT NULL,
  leg_ref VARCHAR(64) NOT NULL,
  start_ms BIGINT NOT NULL,
  end_ms BIGINT NULL,
  track_map TEXT NOT NULL,
  privacy_decision VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_capture_segment_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_capture_segment_ordinal (intent_id, ordinal),
  CONSTRAINT chk_ai_capture_segment_privacy CHECK (privacy_decision IN ('allow','deny','unknown')),
  CONSTRAINT fk_ai_capture_segment_intent FOREIGN KEY (vpbx_user_uid, intent_id)
    REFERENCES ai_capture_intents (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_capture_receipts (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  recording_uid VARCHAR(36) NOT NULL,
  manifest_revision INT NOT NULL,
  digest CHAR(64) NOT NULL,
  asset_id VARCHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL,
  acked_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_capture_receipt_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_capture_receipt_manifest (node_id, recording_uid, manifest_revision),
  CONSTRAINT chk_ai_capture_receipt_status CHECK (status IN ('acked','quarantined')),
  CONSTRAINT fk_ai_capture_receipt_asset FOREIGN KEY (vpbx_user_uid, asset_id)
    REFERENCES ai_media_assets (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
