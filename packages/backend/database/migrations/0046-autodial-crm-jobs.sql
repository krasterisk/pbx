CREATE TABLE IF NOT EXISTS ac_integration_commands (
  vpbx_user_uid INT NOT NULL, key_uid CHAR(36) NOT NULL, request_id VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL, response JSON NOT NULL, created_at DATETIME NOT NULL,
  PRIMARY KEY (vpbx_user_uid, key_uid, request_id)
);
CREATE TABLE IF NOT EXISTS ac_import_jobs (
  uid CHAR(36) NOT NULL PRIMARY KEY, vpbx_user_uid INT NOT NULL, key_uid CHAR(36) NOT NULL,
  base_uid INT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'pending', payload JSON NOT NULL,
  result JSON NULL, error VARCHAR(128) NULL, created_at DATETIME NOT NULL, completed_at DATETIME NULL,
  KEY idx_ac_import_job_pending (status, created_at), KEY idx_ac_import_job_tenant (vpbx_user_uid, key_uid)
);
CREATE TABLE IF NOT EXISTS ac_webhooks (
  uid CHAR(36) NOT NULL PRIMARY KEY, vpbx_user_uid INT NOT NULL, key_uid CHAR(36) NOT NULL,
  url VARCHAR(2048) NOT NULL, secret_cipher TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS ac_webhook_deliveries (
  uid CHAR(36) NOT NULL PRIMARY KEY, webhook_uid CHAR(36) NOT NULL, vpbx_user_uid INT NOT NULL,
  event_key VARCHAR(128) NOT NULL, payload JSON NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0, next_attempt_at DATETIME NOT NULL, response_status INT NULL,
  created_at DATETIME NOT NULL, completed_at DATETIME NULL,
  UNIQUE KEY uq_ac_webhook_event (webhook_uid, event_key), KEY idx_ac_webhook_pending (status, next_attempt_at)
);
