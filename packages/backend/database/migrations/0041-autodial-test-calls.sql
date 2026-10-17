CREATE TABLE ac_test_calls (
  uid VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INT NOT NULL,
  actor_uid INT NOT NULL,
  campaign_uid INT NOT NULL,
  contact_uid INT NOT NULL,
  revision INT NOT NULL,
  idempotency_key VARCHAR(80) NOT NULL,
  endpoint VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  cleanup_done TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_ac_test_idempotency (vpbx_user_uid, actor_uid, idempotency_key),
  KEY idx_ac_test_rate (vpbx_user_uid, actor_uid, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
