CREATE TABLE ai_integration_auth_limits (
  key_hash VARCHAR(64) NOT NULL,
  attempts INT NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (key_hash),
  KEY idx_ai_integration_auth_limit_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
