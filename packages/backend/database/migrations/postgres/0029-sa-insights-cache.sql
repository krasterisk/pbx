-- Durable dashboard insights cache. The key hashes facts, period, skill version and project focus.

CREATE TABLE IF NOT EXISTS sa_insights_cache (
  cache_key CHAR(64) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  payload TEXT NOT NULL,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY (cache_key)
);

CREATE INDEX IF NOT EXISTS idx_sa_insights_cache_project
  ON sa_insights_cache (vpbx_user_uid, project_id);
