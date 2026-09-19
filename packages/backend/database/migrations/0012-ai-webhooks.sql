CREATE TABLE ai_webhook_endpoints (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  destination_url VARCHAR(512) NOT NULL,
  secret_ref VARCHAR(64) NOT NULL,
  key_version INT NOT NULL,
  previous_secret_ref VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL,
  revision INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_webhook_endpoint_tenant (vpbx_user_uid, id),
  CONSTRAINT chk_ai_webhook_endpoint_status CHECK (status IN ('active','revoked','disabled')),
  CONSTRAINT chk_ai_webhook_endpoint_https CHECK (destination_url LIKE 'https://%'),
  CONSTRAINT fk_ai_webhook_endpoint_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_webhook_deliveries (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  event_id VARCHAR(36) NOT NULL,
  endpoint_id VARCHAR(36) NOT NULL,
  endpoint_revision INT NOT NULL,
  payload_digest CHAR(64) NOT NULL,
  state VARCHAR(32) NOT NULL,
  attempt INT NOT NULL,
  next_at DATETIME(3) NULL,
  http_class VARCHAR(16) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_webhook_delivery_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_webhook_delivery_event (event_id, endpoint_id),
  CONSTRAINT chk_ai_webhook_delivery_state CHECK (state IN ('pending','delivered','dead','cancelled')),
  CONSTRAINT fk_ai_webhook_delivery_endpoint FOREIGN KEY (vpbx_user_uid, endpoint_id)
    REFERENCES ai_webhook_endpoints (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_webhook_attempts (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  delivery_id VARCHAR(36) NOT NULL,
  ordinal INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  latency_ms INT NULL,
  error_code VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_webhook_attempt_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_webhook_attempt_ordinal (delivery_id, ordinal),
  CONSTRAINT fk_ai_webhook_attempt_delivery FOREIGN KEY (vpbx_user_uid, delivery_id)
    REFERENCES ai_webhook_deliveries (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
