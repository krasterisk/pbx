CREATE TABLE ai_provider_revisions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  provider_uid VARCHAR(64) NOT NULL,
  revision INTEGER NOT NULL,
  configuration TEXT NOT NULL,
  capability_digest CHAR(64) NOT NULL,
  credential_ref VARCHAR(64) NOT NULL,
  key_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_provider_revision_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_provider_revision_immutable UNIQUE (vpbx_user_uid, provider_uid, revision)
);

CREATE TABLE ai_media_assets (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  source_kind VARCHAR(32) NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  state VARCHAR(32) NOT NULL,
  sha256 CHAR(64),
  bytes BIGINT NOT NULL,
  duration_ms BIGINT,
  media_metadata TEXT NOT NULL,
  retention_at TIMESTAMPTZ,
  parent_asset_id VARCHAR(36),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_media_asset_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_media_asset_storage_key UNIQUE (storage_key),
  CONSTRAINT chk_ai_media_assets_state CHECK (state IN ('allocated','uploading','probing','ready','quarantined','failed','deleting','deleted')),
  CONSTRAINT fk_ai_media_asset_parent FOREIGN KEY (vpbx_user_uid, parent_asset_id)
    REFERENCES ai_media_assets (vpbx_user_uid, id)
);
CREATE INDEX idx_ai_media_asset_tenant_state_created ON ai_media_assets (vpbx_user_uid, state, created_at);
CREATE INDEX idx_ai_media_asset_state_retention ON ai_media_assets (state, retention_at);

CREATE TABLE ai_uploads (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  resource_kind VARCHAR(32) NOT NULL,
  resource_id VARCHAR(36) NOT NULL,
  asset_id VARCHAR(36) NOT NULL,
  state VARCHAR(32) NOT NULL,
  expected_bytes BIGINT,
  expected_checksum CHAR(64),
  received_bytes BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  request_hash CHAR(64) NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_upload_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_upload_asset UNIQUE (asset_id),
  CONSTRAINT chk_ai_uploads_state CHECK (state IN ('allocated','uploading','completed','expired','failed')),
  CONSTRAINT fk_ai_upload_asset FOREIGN KEY (vpbx_user_uid, asset_id)
    REFERENCES ai_media_assets (vpbx_user_uid, id)
);
CREATE INDEX idx_ai_upload_tenant_principal ON ai_uploads (vpbx_user_uid, principal_id, id);

CREATE TABLE ai_idempotency (
  vpbx_user_uid INTEGER NOT NULL,
  stable_principal_id VARCHAR(36) NOT NULL,
  operation_namespace VARCHAR(64) NOT NULL,
  key_digest BYTEA NOT NULL,
  request_hash CHAR(64) NOT NULL,
  state VARCHAR(32) NOT NULL,
  resource_id VARCHAR(36),
  response_status INTEGER,
  safe_response TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (vpbx_user_uid, stable_principal_id, operation_namespace, key_digest),
  CONSTRAINT chk_ai_idempotency_state CHECK (state IN ('started','completed'))
);
CREATE INDEX idx_ai_idempotency_expires ON ai_idempotency (expires_at);

CREATE TABLE ai_jobs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  product VARCHAR(64) NOT NULL,
  kind VARCHAR(64) NOT NULL,
  resource_kind VARCHAR(32) NOT NULL,
  resource_id VARCHAR(36) NOT NULL,
  state VARCHAR(32) NOT NULL,
  policy_revision_id VARCHAR(36),
  config_revision_id VARCHAR(36),
  provider_revision_id VARCHAR(36),
  priority INTEGER NOT NULL,
  cancel_requested_at TIMESTAMPTZ,
  admitted_at TIMESTAMPTZ NOT NULL,
  terminal_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  version INTEGER NOT NULL,
  idempotency_principal_id VARCHAR(36),
  idempotency_namespace VARCHAR(64),
  idempotency_key_digest BYTEA,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_job_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT chk_ai_jobs_state CHECK (state IN ('queued','running','succeeded','failed','cancelled','retry_wait','awaiting_reconciliation','blocked')),
  CONSTRAINT chk_ai_jobs_idempotency_tuple CHECK (
    (idempotency_principal_id IS NULL AND idempotency_namespace IS NULL AND idempotency_key_digest IS NULL)
    OR (idempotency_principal_id IS NOT NULL AND idempotency_namespace IS NOT NULL AND idempotency_key_digest IS NOT NULL)
  ),
  CONSTRAINT fk_ai_job_provider_revision FOREIGN KEY (vpbx_user_uid, provider_revision_id)
    REFERENCES ai_provider_revisions (vpbx_user_uid, id),
  CONSTRAINT fk_ai_job_idempotency FOREIGN KEY (vpbx_user_uid, idempotency_principal_id, idempotency_namespace, idempotency_key_digest)
    REFERENCES ai_idempotency (vpbx_user_uid, stable_principal_id, operation_namespace, key_digest)
);
CREATE INDEX idx_ai_job_tenant_state_created ON ai_jobs (vpbx_user_uid, state, created_at);
CREATE INDEX idx_ai_job_state_next_run ON ai_jobs (state, next_run_at);

CREATE TABLE ai_job_stages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  job_id VARCHAR(36) NOT NULL,
  stage_key VARCHAR(64) NOT NULL,
  state VARCHAR(32) NOT NULL,
  attempt_count INTEGER NOT NULL,
  next_run_at TIMESTAMPTZ,
  lease_owner VARCHAR(64),
  lease_until TIMESTAMPTZ,
  fence BIGINT NOT NULL,
  output_ref TEXT,
  error_code VARCHAR(64),
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_job_stage_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_job_stage_key UNIQUE (job_id, stage_key),
  CONSTRAINT chk_ai_job_stages_state CHECK (state IN ('pending','leased','executing','succeeded','failed','cancelled','unknown')),
  CONSTRAINT fk_ai_job_stage_job FOREIGN KEY (vpbx_user_uid, job_id)
    REFERENCES ai_jobs (vpbx_user_uid, id)
);
CREATE INDEX idx_ai_job_stage_lease ON ai_job_stages (state, next_run_at, lease_until);

CREATE TABLE ai_provider_operations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  stage_id VARCHAR(36) NOT NULL,
  ordinal INTEGER NOT NULL,
  provider_revision_id VARCHAR(36) NOT NULL,
  state VARCHAR(32) NOT NULL,
  idempotency_token CHAR(64) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  provider_request_id VARCHAR(128),
  response_ref TEXT,
  usage_ref TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_provider_operation_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_provider_operation_ordinal UNIQUE (stage_id, ordinal),
  CONSTRAINT chk_ai_provider_operations_state CHECK (state IN ('prepared','dispatched','observed_success','observed_failure','unknown','reconciled_success','reconciled_failure')),
  CONSTRAINT fk_ai_provider_operation_stage FOREIGN KEY (vpbx_user_uid, stage_id)
    REFERENCES ai_job_stages (vpbx_user_uid, id),
  CONSTRAINT fk_ai_provider_operation_revision FOREIGN KEY (vpbx_user_uid, provider_revision_id)
    REFERENCES ai_provider_revisions (vpbx_user_uid, id)
);

CREATE TABLE ai_outbox (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  aggregate_kind VARCHAR(32) NOT NULL,
  aggregate_id VARCHAR(36) NOT NULL,
  aggregate_version INTEGER NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  schema_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  available_at TIMESTAMPTZ NOT NULL,
  lease_until TIMESTAMPTZ,
  lease_owner VARCHAR(64),
  fence BIGINT NOT NULL,
  delivered_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_outbox_event UNIQUE (aggregate_kind, aggregate_id, aggregate_version, event_type)
);
CREATE INDEX idx_ai_outbox_pending ON ai_outbox (delivered_at, available_at);
CREATE INDEX idx_ai_outbox_tenant ON ai_outbox (vpbx_user_uid, created_at);

CREATE TABLE ai_job_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  job_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  from_state VARCHAR(32),
  to_state VARCHAR(32),
  actor VARCHAR(64) NOT NULL,
  reason VARCHAR(128),
  occurred_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_ai_job_event_job FOREIGN KEY (vpbx_user_uid, job_id)
    REFERENCES ai_jobs (vpbx_user_uid, id)
);
CREATE INDEX idx_ai_job_event_tenant_job_time ON ai_job_events (vpbx_user_uid, job_id, occurred_at);
