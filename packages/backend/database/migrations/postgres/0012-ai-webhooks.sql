CREATE TABLE ai_webhook_endpoints (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  destination_url VARCHAR(512) NOT NULL,
  secret_ref VARCHAR(64) NOT NULL,
  key_version INTEGER NOT NULL,
  previous_secret_ref VARCHAR(64),
  status VARCHAR(32) NOT NULL,
  revision INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_webhook_endpoint_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT chk_ai_webhook_endpoint_status CHECK (status IN ('active','revoked','disabled')),
  CONSTRAINT chk_ai_webhook_endpoint_https CHECK (destination_url LIKE 'https://%'),
  CONSTRAINT fk_ai_webhook_endpoint_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
);

CREATE TABLE ai_webhook_deliveries (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  event_id VARCHAR(36) NOT NULL,
  endpoint_id VARCHAR(36) NOT NULL,
  endpoint_revision INTEGER NOT NULL,
  payload_digest CHAR(64) NOT NULL,
  state VARCHAR(32) NOT NULL,
  attempt INTEGER NOT NULL,
  next_at TIMESTAMPTZ,
  http_class VARCHAR(16),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_webhook_delivery_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_webhook_delivery_event UNIQUE (event_id, endpoint_id),
  CONSTRAINT chk_ai_webhook_delivery_state CHECK (state IN ('pending','delivered','dead','cancelled')),
  CONSTRAINT fk_ai_webhook_delivery_endpoint FOREIGN KEY (vpbx_user_uid, endpoint_id)
    REFERENCES ai_webhook_endpoints (vpbx_user_uid, id)
);

CREATE TABLE ai_webhook_attempts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  delivery_id VARCHAR(36) NOT NULL,
  ordinal INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL,
  latency_ms INTEGER,
  error_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_webhook_attempt_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_webhook_attempt_ordinal UNIQUE (delivery_id, ordinal),
  CONSTRAINT fk_ai_webhook_attempt_delivery FOREIGN KEY (vpbx_user_uid, delivery_id)
    REFERENCES ai_webhook_deliveries (vpbx_user_uid, id)
);
