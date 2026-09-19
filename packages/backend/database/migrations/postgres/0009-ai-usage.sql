CREATE TABLE ai_quota_counters (
  vpbx_user_uid INTEGER NOT NULL,
  product VARCHAR(64) NOT NULL,
  metric VARCHAR(64) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  limit_units BIGINT NOT NULL,
  used_units BIGINT NOT NULL,
  reserved_units BIGINT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (vpbx_user_uid, product, metric, period_start),
  CONSTRAINT chk_ai_quota_metric CHECK (metric IN (
    'concurrent_jobs','concurrent_sessions','storage_bytes','audio_ms','provider_tokens')),
  CONSTRAINT chk_ai_quota_nonneg CHECK (limit_units >= 0 AND used_units >= 0 AND reserved_units >= 0)
);

CREATE TABLE ai_price_revisions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  provider_uid VARCHAR(64) NOT NULL,
  product VARCHAR(64) NOT NULL,
  unit VARCHAR(32) NOT NULL,
  currency VARCHAR(8),
  rate NUMERIC(20,10),
  scale INTEGER NOT NULL,
  rounding_mode VARCHAR(16) NOT NULL,
  money_policy VARCHAR(32) NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  config_digest CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_price_revision_immutable UNIQUE (provider_uid, product, unit, effective_at, config_digest),
  CONSTRAINT chk_ai_price_rounding CHECK (rounding_mode IN ('half_up')),
  CONSTRAINT chk_ai_price_policy CHECK (money_policy IN ('shadow','local_byok','cloud_wallet')),
  CONSTRAINT chk_ai_price_unknown CHECK (
    (rate IS NULL AND currency IS NULL) OR (rate IS NOT NULL AND rate > 0 AND currency IS NOT NULL)
  )
);

CREATE TABLE ai_usage_reservations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  job_id VARCHAR(36) NOT NULL,
  provider_operation_id VARCHAR(36),
  parent_reservation_id VARCHAR(36),
  owner_key VARCHAR(80) NOT NULL,
  metric VARCHAR(64) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  held_units BIGINT NOT NULL,
  settled_units BIGINT NOT NULL,
  state VARCHAR(32) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  heartbeat_at TIMESTAMPTZ,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_usage_reservation_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_usage_reservation_owner UNIQUE (owner_key, metric, period_start),
  CONSTRAINT chk_ai_usage_reservation_state CHECK (state IN ('held','settled','released','expired','overage')),
  CONSTRAINT chk_ai_usage_reservation_owner CHECK (
    owner_key ~ '^(job|operation):[0-9a-fA-F-]{8,36}$'),
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
);
CREATE INDEX idx_ai_usage_reservation_job ON ai_usage_reservations (vpbx_user_uid, job_id);

CREATE TABLE ai_usage_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  provider_operation_id VARCHAR(36) NOT NULL,
  event_key VARCHAR(64) NOT NULL,
  quantity BIGINT NOT NULL,
  unit VARCHAR(32) NOT NULL,
  source VARCHAR(32) NOT NULL,
  price_revision_id VARCHAR(36),
  occurred_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_usage_event_operation UNIQUE (provider_operation_id, event_key),
  CONSTRAINT chk_ai_usage_event_source CHECK (source IN ('measured','estimated','reconciled')),
  CONSTRAINT fk_ai_usage_event_operation FOREIGN KEY (vpbx_user_uid, provider_operation_id)
    REFERENCES ai_provider_operations (vpbx_user_uid, id),
  CONSTRAINT fk_ai_usage_event_price FOREIGN KEY (price_revision_id)
    REFERENCES ai_price_revisions (id)
);

CREATE TABLE ai_usage_ledger (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  reservation_id VARCHAR(36) NOT NULL,
  operation_id VARCHAR(80) NOT NULL,
  entry_kind VARCHAR(16) NOT NULL,
  sequence INTEGER NOT NULL,
  units BIGINT NOT NULL,
  amount_decimal NUMERIC(20,10),
  currency VARCHAR(8),
  price_revision_id VARCHAR(36),
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_usage_ledger_seq UNIQUE (operation_id, entry_kind, sequence),
  CONSTRAINT chk_ai_usage_ledger_kind CHECK (entry_kind IN ('reserve','settle','release','adjust')),
  CONSTRAINT fk_ai_usage_ledger_reservation FOREIGN KEY (vpbx_user_uid, reservation_id)
    REFERENCES ai_usage_reservations (vpbx_user_uid, id),
  CONSTRAINT fk_ai_usage_ledger_price FOREIGN KEY (price_revision_id)
    REFERENCES ai_price_revisions (id)
);
