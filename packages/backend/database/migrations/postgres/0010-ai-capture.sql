CREATE TABLE ai_capture_node_bindings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  node_id VARCHAR(64) NOT NULL,
  vpbx_user_uid INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL,
  identity_digest CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  config_digest CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_capture_binding_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_capture_binding_node_rev UNIQUE (node_id, revision),
  CONSTRAINT chk_ai_capture_binding_status CHECK (status IN ('active','revoked','expired'))
);

CREATE TABLE ai_capture_intents (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  recording_uid VARCHAR(36) NOT NULL,
  origin_kind VARCHAR(32) NOT NULL,
  origin_id VARCHAR(128) NOT NULL,
  recorder_id VARCHAR(64) NOT NULL,
  binding_id VARCHAR(36) NOT NULL,
  binding_revision INTEGER NOT NULL,
  state VARCHAR(32) NOT NULL,
  policy_snapshot TEXT NOT NULL,
  call_ref VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  CONSTRAINT uq_ai_capture_intent_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_capture_intent_node_recording UNIQUE (node_id, recording_uid),
  CONSTRAINT chk_ai_capture_intent_origin CHECK (origin_kind IN ('pbx_route','robot_session')),
  CONSTRAINT chk_ai_capture_intent_state CHECK (state IN ('open','closed','quarantined','failed')),
  CONSTRAINT fk_ai_capture_intent_binding FOREIGN KEY (vpbx_user_uid, binding_id)
    REFERENCES ai_capture_node_bindings (vpbx_user_uid, id)
);
CREATE INDEX idx_ai_capture_intent_tenant_state ON ai_capture_intents (vpbx_user_uid, state, created_at);

CREATE TABLE ai_capture_segments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  intent_id VARCHAR(36) NOT NULL,
  ordinal INTEGER NOT NULL,
  leg_ref VARCHAR(64) NOT NULL,
  start_ms BIGINT NOT NULL,
  end_ms BIGINT,
  track_map TEXT NOT NULL,
  privacy_decision VARCHAR(32) NOT NULL,
  CONSTRAINT uq_ai_capture_segment_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_capture_segment_ordinal UNIQUE (intent_id, ordinal),
  CONSTRAINT chk_ai_capture_segment_privacy CHECK (privacy_decision IN ('allow','deny','unknown')),
  CONSTRAINT fk_ai_capture_segment_intent FOREIGN KEY (vpbx_user_uid, intent_id)
    REFERENCES ai_capture_intents (vpbx_user_uid, id)
);

CREATE TABLE ai_capture_receipts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  recording_uid VARCHAR(36) NOT NULL,
  manifest_revision INTEGER NOT NULL,
  digest CHAR(64) NOT NULL,
  asset_id VARCHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL,
  acked_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_capture_receipt_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_capture_receipt_manifest UNIQUE (node_id, recording_uid, manifest_revision),
  CONSTRAINT chk_ai_capture_receipt_status CHECK (status IN ('acked','quarantined')),
  CONSTRAINT fk_ai_capture_receipt_asset FOREIGN KEY (vpbx_user_uid, asset_id)
    REFERENCES ai_media_assets (vpbx_user_uid, id)
);
