CREATE TABLE ac_test_calls (
  uid VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  actor_uid INTEGER NOT NULL,
  campaign_uid INTEGER NOT NULL,
  contact_uid INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  idempotency_key VARCHAR(80) NOT NULL,
  endpoint VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  cleanup_done BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (vpbx_user_uid, actor_uid, idempotency_key)
);
CREATE INDEX idx_ac_test_rate ON ac_test_calls (vpbx_user_uid, actor_uid, created_at);
