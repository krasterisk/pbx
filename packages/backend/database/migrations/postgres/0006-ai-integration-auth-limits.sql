CREATE TABLE ai_integration_auth_limits (
  key_hash VARCHAR(64) NOT NULL PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_ai_integration_auth_limit_expiry ON ai_integration_auth_limits (expires_at);
