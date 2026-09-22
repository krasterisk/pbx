-- Multi-run regenerate + SA-CHARGE persist columns (D-05, D-12, D-46, D-47).
-- Analytics journal stays in sa_* tables; never writes Asterisk CDR rows.
-- uq_sa_run_initial was already dropped in 0014; drop again only if present (idempotent).

SET @sa_uq_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sa_analysis_runs'
    AND index_name = 'uq_sa_run_initial'
);
SET @sa_uq_sql := IF(
  @sa_uq_exists > 0,
  'ALTER TABLE sa_analysis_runs DROP INDEX uq_sa_run_initial',
  'SELECT 1'
);
PREPARE sa_uq_stmt FROM @sa_uq_sql;
EXECUTE sa_uq_stmt;
DEALLOCATE PREPARE sa_uq_stmt;

ALTER TABLE sa_analysis_runs
  ADD COLUMN amount DECIMAL(20, 10) NULL AFTER reason,
  ADD COLUMN currency VARCHAR(8) NULL AFTER amount,
  ADD COLUMN audio_ms BIGINT NULL AFTER currency,
  ADD COLUMN provider_tokens BIGINT NULL AFTER audio_ms,
  ADD COLUMN charged TINYINT(1) NOT NULL DEFAULT 0 AFTER provider_tokens;

CREATE TABLE sa_insights_requests (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  amount DECIMAL(20, 10) NULL,
  currency VARCHAR(8) NULL,
  provider_tokens BIGINT NULL,
  charged TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sa_insights_req_tenant (vpbx_user_uid, id),
  KEY idx_sa_insights_req_project (vpbx_user_uid, project_id, created_at),
  CONSTRAINT fk_sa_insights_req_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
