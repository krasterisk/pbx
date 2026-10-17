CREATE TABLE IF NOT EXISTS ac_integration_keys (
  uid CHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INT NOT NULL,
  created_by INT NOT NULL,
  label VARCHAR(120) NOT NULL,
  secret_hash CHAR(64) NOT NULL,
  scopes JSON NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  rate_window BIGINT NOT NULL DEFAULT 0,
  rate_count INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_ac_integration_secret (secret_hash),
  KEY idx_ac_integration_tenant (vpbx_user_uid)
);
