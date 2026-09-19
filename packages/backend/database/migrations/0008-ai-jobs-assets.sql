CREATE TABLE ai_provider_revisions (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  provider_uid VARCHAR(64) NOT NULL,
  revision INT NOT NULL,
  configuration TEXT NOT NULL,
  capability_digest CHAR(64) NOT NULL,
  credential_ref VARCHAR(64) NOT NULL,
  key_version INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_provider_revision_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_provider_revision_immutable (vpbx_user_uid, provider_uid, revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_media_assets (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  source_kind VARCHAR(32) NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  state VARCHAR(32) NOT NULL,
  sha256 CHAR(64) NULL,
  bytes BIGINT NOT NULL,
  duration_ms BIGINT NULL,
  media_metadata TEXT NOT NULL,
  retention_at DATETIME(3) NULL,
  parent_asset_id VARCHAR(36) NULL,
  deleted_at DATETIME(3) NULL,
  version INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_media_asset_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_media_asset_storage_key (storage_key),
  KEY idx_ai_media_asset_tenant_state_created (vpbx_user_uid, state, created_at),
  KEY idx_ai_media_asset_state_retention (state, retention_at),
  CONSTRAINT chk_ai_media_assets_state CHECK (state IN ('allocated','uploading','probing','ready','quarantined','failed','deleting','deleted')),
  CONSTRAINT fk_ai_media_asset_parent FOREIGN KEY (vpbx_user_uid, parent_asset_id)
    REFERENCES ai_media_assets (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_uploads (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  resource_kind VARCHAR(32) NOT NULL,
  resource_id VARCHAR(36) NOT NULL,
  asset_id VARCHAR(36) NOT NULL,
  state VARCHAR(32) NOT NULL,
  expected_bytes BIGINT NULL,
  expected_checksum CHAR(64) NULL,
  received_bytes BIGINT NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  version INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_upload_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_upload_asset (asset_id),
  KEY idx_ai_upload_tenant_principal (vpbx_user_uid, principal_id, id),
  CONSTRAINT chk_ai_uploads_state CHECK (state IN ('allocated','uploading','completed','expired','failed')),
  CONSTRAINT fk_ai_upload_asset FOREIGN KEY (vpbx_user_uid, asset_id)
    REFERENCES ai_media_assets (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_idempotency (
  vpbx_user_uid INT NOT NULL,
  stable_principal_id VARCHAR(36) NOT NULL,
  operation_namespace VARCHAR(64) NOT NULL,
  key_digest BINARY(32) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  state VARCHAR(32) NOT NULL,
  resource_id VARCHAR(36) NULL,
  response_status INT NULL,
  safe_response TEXT NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (vpbx_user_uid, stable_principal_id, operation_namespace, key_digest),
  KEY idx_ai_idempotency_expires (expires_at),
  CONSTRAINT chk_ai_idempotency_state CHECK (state IN ('started','completed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_jobs (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  product VARCHAR(64) NOT NULL,
  kind VARCHAR(64) NOT NULL,
  resource_kind VARCHAR(32) NOT NULL,
  resource_id VARCHAR(36) NOT NULL,
  state VARCHAR(32) NOT NULL,
  policy_revision_id VARCHAR(36) NULL,
  config_revision_id VARCHAR(36) NULL,
  provider_revision_id VARCHAR(36) NULL,
  priority INT NOT NULL,
  cancel_requested_at DATETIME(3) NULL,
  admitted_at DATETIME(3) NOT NULL,
  terminal_at DATETIME(3) NULL,
  next_run_at DATETIME(3) NULL,
  version INT NOT NULL,
  idempotency_principal_id VARCHAR(36) NULL,
  idempotency_namespace VARCHAR(64) NULL,
  idempotency_key_digest BINARY(32) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_job_tenant (vpbx_user_uid, id),
  KEY idx_ai_job_tenant_state_created (vpbx_user_uid, state, created_at),
  KEY idx_ai_job_state_next_run (state, next_run_at),
  CONSTRAINT chk_ai_jobs_state CHECK (state IN ('queued','running','succeeded','failed','cancelled','retry_wait','awaiting_reconciliation','blocked')),
  CONSTRAINT chk_ai_jobs_idempotency_tuple CHECK (
    (idempotency_principal_id IS NULL AND idempotency_namespace IS NULL AND idempotency_key_digest IS NULL)
    OR (idempotency_principal_id IS NOT NULL AND idempotency_namespace IS NOT NULL AND idempotency_key_digest IS NOT NULL)
  ),
  CONSTRAINT fk_ai_job_provider_revision FOREIGN KEY (vpbx_user_uid, provider_revision_id)
    REFERENCES ai_provider_revisions (vpbx_user_uid, id),
  CONSTRAINT fk_ai_job_idempotency FOREIGN KEY (vpbx_user_uid, idempotency_principal_id, idempotency_namespace, idempotency_key_digest)
    REFERENCES ai_idempotency (vpbx_user_uid, stable_principal_id, operation_namespace, key_digest)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_job_stages (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  job_id VARCHAR(36) NOT NULL,
  stage_key VARCHAR(64) NOT NULL,
  state VARCHAR(32) NOT NULL,
  attempt_count INT NOT NULL,
  next_run_at DATETIME(3) NULL,
  lease_owner VARCHAR(64) NULL,
  lease_until DATETIME(3) NULL,
  fence BIGINT NOT NULL,
  output_ref TEXT NULL,
  error_code VARCHAR(64) NULL,
  version INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_job_stage_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_job_stage_key (job_id, stage_key),
  KEY idx_ai_job_stage_lease (state, next_run_at, lease_until),
  CONSTRAINT chk_ai_job_stages_state CHECK (state IN ('pending','leased','executing','succeeded','failed','cancelled','unknown')),
  CONSTRAINT fk_ai_job_stage_job FOREIGN KEY (vpbx_user_uid, job_id)
    REFERENCES ai_jobs (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_provider_operations (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  stage_id VARCHAR(36) NOT NULL,
  ordinal INT NOT NULL,
  provider_revision_id VARCHAR(36) NOT NULL,
  state VARCHAR(32) NOT NULL,
  idempotency_token CHAR(64) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  provider_request_id VARCHAR(128) NULL,
  response_ref TEXT NULL,
  usage_ref TEXT NULL,
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  version INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_provider_operation_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_provider_operation_ordinal (stage_id, ordinal),
  CONSTRAINT chk_ai_provider_operations_state CHECK (state IN ('prepared','dispatched','observed_success','observed_failure','unknown','reconciled_success','reconciled_failure')),
  CONSTRAINT fk_ai_provider_operation_stage FOREIGN KEY (vpbx_user_uid, stage_id)
    REFERENCES ai_job_stages (vpbx_user_uid, id),
  CONSTRAINT fk_ai_provider_operation_revision FOREIGN KEY (vpbx_user_uid, provider_revision_id)
    REFERENCES ai_provider_revisions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_outbox (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  aggregate_kind VARCHAR(32) NOT NULL,
  aggregate_id VARCHAR(36) NOT NULL,
  aggregate_version INT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  schema_version INT NOT NULL,
  payload TEXT NOT NULL,
  available_at DATETIME(3) NOT NULL,
  lease_until DATETIME(3) NULL,
  lease_owner VARCHAR(64) NULL,
  fence BIGINT NOT NULL,
  delivered_at DATETIME(3) NULL,
  attempts INT NOT NULL,
  version INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_outbox_event (aggregate_kind, aggregate_id, aggregate_version, event_type),
  KEY idx_ai_outbox_pending (delivered_at, available_at),
  KEY idx_ai_outbox_tenant (vpbx_user_uid, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_job_events (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  job_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  from_state VARCHAR(32) NULL,
  to_state VARCHAR(32) NULL,
  actor VARCHAR(64) NOT NULL,
  reason VARCHAR(128) NULL,
  occurred_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_ai_job_event_tenant_job_time (vpbx_user_uid, job_id, occurred_at),
  CONSTRAINT fk_ai_job_event_job FOREIGN KEY (vpbx_user_uid, job_id)
    REFERENCES ai_jobs (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
