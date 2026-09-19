CREATE TABLE ai_quota_counters (
  vpbx_user_uid INT NOT NULL,
  product VARCHAR(64) NOT NULL,
  metric VARCHAR(64) NOT NULL,
  period_start DATETIME(3) NOT NULL,
  limit_units BIGINT NOT NULL,
  used_units BIGINT NOT NULL,
  reserved_units BIGINT NOT NULL,
  revision INT NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (vpbx_user_uid, product, metric, period_start),
  CONSTRAINT chk_ai_quota_metric CHECK (metric IN (
    'concurrent_jobs','concurrent_sessions','storage_bytes','audio_ms','provider_tokens')),
  CONSTRAINT chk_ai_quota_nonneg CHECK (limit_units >= 0 AND used_units >= 0 AND reserved_units >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_price_revisions (
  id VARCHAR(36) NOT NULL,
  provider_uid VARCHAR(64) NOT NULL,
  product VARCHAR(64) NOT NULL,
  unit VARCHAR(32) NOT NULL,
  currency VARCHAR(8) NULL,
  rate DECIMAL(20,10) NULL,
  scale INT NOT NULL,
  rounding_mode VARCHAR(16) NOT NULL,
  money_policy VARCHAR(32) NOT NULL,
  effective_at DATETIME(3) NOT NULL,
  config_digest CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_price_revision_immutable (provider_uid, product, unit, effective_at, config_digest),
  CONSTRAINT chk_ai_price_rounding CHECK (rounding_mode IN ('half_up')),
  CONSTRAINT chk_ai_price_policy CHECK (money_policy IN ('shadow','local_byok','cloud_wallet')),
  CONSTRAINT chk_ai_price_unknown CHECK (
    (rate IS NULL AND currency IS NULL) OR (rate IS NOT NULL AND rate > 0 AND currency IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_usage_reservations (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  job_id VARCHAR(36) NOT NULL,
  provider_operation_id VARCHAR(36) NULL,
  parent_reservation_id VARCHAR(36) NULL,
  owner_key VARCHAR(80) NOT NULL,
  metric VARCHAR(64) NOT NULL,
  period_start DATETIME(3) NOT NULL,
  held_units BIGINT NOT NULL,
  settled_units BIGINT NOT NULL,
  state VARCHAR(32) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  heartbeat_at DATETIME(3) NULL,
  version INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_usage_reservation_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_usage_reservation_owner (owner_key, metric, period_start),
  KEY idx_ai_usage_reservation_job (vpbx_user_uid, job_id),
  CONSTRAINT chk_ai_usage_reservation_state CHECK (state IN ('held','settled','released','expired','overage')),
  CONSTRAINT chk_ai_usage_reservation_owner CHECK (
    owner_key REGEXP '^(job|operation):[0-9a-fA-F-]{8,36}$'),
  CONSTRAINT chk_ai_usage_reservation_parent CHECK (
    (parent_reservation_id IS NULL AND provider_operation_id IS NULL AND owner_key LIKE 'job:%')
    OR (parent_reservation_id IS NOT NULL AND provider_operation_id IS NOT NULL AND owner_key LIKE 'operation:%')
  ),
  CONSTRAINT chk_ai_usage_reservation_units CHECK (held_units >= 0 AND settled_units >= 0),
  CONSTRAINT fk_ai_usage_reservation_job FOREIGN KEY (vpbx_user_uid, job_id)
    REFERENCES ai_jobs (vpbx_user_uid, id),
  CONSTRAINT fk_ai_usage_reservation_operation FOREIGN KEY (vpbx_user_uid, provider_operation_id)
    REFERENCES ai_provider_operations (vpbx_user_uid, id),
  CONSTRAINT fk_ai_usage_reservation_parent FOREIGN KEY (vpbx_user_uid, parent_reservation_id)
    REFERENCES ai_usage_reservations (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_usage_events (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  provider_operation_id VARCHAR(36) NOT NULL,
  event_key VARCHAR(64) NOT NULL,
  quantity BIGINT NOT NULL,
  unit VARCHAR(32) NOT NULL,
  source VARCHAR(32) NOT NULL,
  price_revision_id VARCHAR(36) NULL,
  occurred_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_usage_event_operation (provider_operation_id, event_key),
  CONSTRAINT chk_ai_usage_event_source CHECK (source IN ('measured','estimated','reconciled')),
  CONSTRAINT fk_ai_usage_event_operation FOREIGN KEY (vpbx_user_uid, provider_operation_id)
    REFERENCES ai_provider_operations (vpbx_user_uid, id),
  CONSTRAINT fk_ai_usage_event_price FOREIGN KEY (price_revision_id)
    REFERENCES ai_price_revisions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_usage_ledger (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  reservation_id VARCHAR(36) NOT NULL,
  operation_id VARCHAR(80) NOT NULL,
  entry_kind VARCHAR(16) NOT NULL,
  sequence INT NOT NULL,
  units BIGINT NOT NULL,
  amount_decimal DECIMAL(20,10) NULL,
  currency VARCHAR(8) NULL,
  price_revision_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_usage_ledger_seq (operation_id, entry_kind, sequence),
  CONSTRAINT chk_ai_usage_ledger_kind CHECK (entry_kind IN ('reserve','settle','release','adjust')),
  CONSTRAINT fk_ai_usage_ledger_reservation FOREIGN KEY (vpbx_user_uid, reservation_id)
    REFERENCES ai_usage_reservations (vpbx_user_uid, id),
  CONSTRAINT fk_ai_usage_ledger_price FOREIGN KEY (price_revision_id)
    REFERENCES ai_price_revisions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
