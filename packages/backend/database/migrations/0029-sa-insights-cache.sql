-- Durable dashboard insights cache. The key hashes facts, period, skill version and project focus.
-- Missing table must not block analysis. Insights fall through to a fresh model call.

CREATE TABLE IF NOT EXISTS sa_insights_cache (
  cache_key CHAR(64) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  payload TEXT NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (cache_key),
  KEY idx_sa_insights_cache_project (vpbx_user_uid, project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
