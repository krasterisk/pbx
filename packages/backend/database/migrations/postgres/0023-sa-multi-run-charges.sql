-- Multi-run regenerate + SA-CHARGE persist columns (D-05, D-12, D-46, D-47).
-- Analytics journal stays in sa_* tables; never writes Asterisk CDR rows.
-- uq_sa_run_initial was already dropped in 0014; IF EXISTS keeps this idempotent.

ALTER TABLE sa_analysis_runs DROP CONSTRAINT IF EXISTS uq_sa_run_initial;

ALTER TABLE sa_analysis_runs
  ADD COLUMN IF NOT EXISTS amount DECIMAL(20, 10) NULL,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(8) NULL,
  ADD COLUMN IF NOT EXISTS audio_ms BIGINT NULL,
  ADD COLUMN IF NOT EXISTS provider_tokens BIGINT NULL,
  ADD COLUMN IF NOT EXISTS charged BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS sa_insights_requests (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  amount DECIMAL(20, 10) NULL,
  currency VARCHAR(8) NULL,
  provider_tokens BIGINT NULL,
  charged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ(3) NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_sa_insights_req_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT fk_sa_insights_req_project FOREIGN KEY (vpbx_user_uid, project_id)
    REFERENCES sa_projects (vpbx_user_uid, id)
);

CREATE INDEX IF NOT EXISTS idx_sa_insights_req_project
  ON sa_insights_requests (vpbx_user_uid, project_id, created_at);
