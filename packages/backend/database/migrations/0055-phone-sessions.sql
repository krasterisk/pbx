-- Ordinary-user telephone ownership; the primary ps_endpoints row serializes SIP/WebRTC/CC acquisition.
CREATE TABLE phone_sessions (
  tenant INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  endpoint VARCHAR(255) NULL,
  mode VARCHAR(8) NULL,
  owner_hash VARCHAR(64) NULL,
  expires_at BIGINT NOT NULL DEFAULT 0,
  dial_pending_until BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant, user_id)
);
CREATE INDEX idx_phone_session_endpoint ON phone_sessions (tenant, endpoint, expires_at);
