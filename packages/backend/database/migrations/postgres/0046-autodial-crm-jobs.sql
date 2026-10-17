CREATE TABLE IF NOT EXISTS ac_integration_commands (
  vpbx_user_uid INTEGER NOT NULL, key_uid CHAR(36) NOT NULL, request_id VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL, response JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (vpbx_user_uid, key_uid, request_id)
);
CREATE TABLE IF NOT EXISTS ac_import_jobs (
  uid CHAR(36) NOT NULL PRIMARY KEY, vpbx_user_uid INTEGER NOT NULL, key_uid CHAR(36) NOT NULL,
  base_uid INTEGER NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'pending', payload JSONB NOT NULL,
  result JSONB NULL, error VARCHAR(128) NULL, created_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_ac_import_job_pending ON ac_import_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_ac_import_job_tenant ON ac_import_jobs (vpbx_user_uid, key_uid);
CREATE TABLE IF NOT EXISTS ac_webhooks (
  uid CHAR(36) NOT NULL PRIMARY KEY, vpbx_user_uid INTEGER NOT NULL, key_uid CHAR(36) NOT NULL,
  url VARCHAR(2048) NOT NULL, secret_cipher TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS ac_webhook_deliveries (
  uid CHAR(36) NOT NULL PRIMARY KEY, webhook_uid CHAR(36) NOT NULL, vpbx_user_uid INTEGER NOT NULL,
  event_key VARCHAR(128) NOT NULL, payload JSONB NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at TIMESTAMPTZ NOT NULL, response_status INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ NULL,
  UNIQUE (webhook_uid, event_key)
);
CREATE INDEX IF NOT EXISTS idx_ac_webhook_pending ON ac_webhook_deliveries (status, next_attempt_at);
