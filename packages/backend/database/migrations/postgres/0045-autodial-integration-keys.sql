CREATE TABLE IF NOT EXISTS ac_integration_keys (
  uid CHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  label VARCHAR(120) NOT NULL,
  secret_hash CHAR(64) NOT NULL UNIQUE,
  scopes JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  rate_window BIGINT NOT NULL DEFAULT 0,
  rate_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ac_integration_tenant ON ac_integration_keys (vpbx_user_uid);
