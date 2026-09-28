-- Tenant speech-analytics model policy. Default off: the cabinet uses platform models.

SET @sa_own := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'tenants' AND column_name = 'sa_own_models'
);
SET @sa_own_sql := IF(@sa_own = 0, 'ALTER TABLE tenants ADD COLUMN sa_own_models TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE sa_own_stmt FROM @sa_own_sql;
EXECUTE sa_own_stmt;
DEALLOCATE PREPARE sa_own_stmt;

SET @sa_override := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'tenants' AND column_name = 'sa_project_model_override'
);
SET @sa_override_sql := IF(@sa_override = 0, 'ALTER TABLE tenants ADD COLUMN sa_project_model_override TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE sa_override_stmt FROM @sa_override_sql;
EXECUTE sa_override_stmt;
DEALLOCATE PREPARE sa_override_stmt;

SET @sa_stt := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'tenants' AND column_name = 'sa_stt_provider_uid'
);
SET @sa_stt_sql := IF(@sa_stt = 0, 'ALTER TABLE tenants ADD COLUMN sa_stt_provider_uid INT NULL', 'SELECT 1');
PREPARE sa_stt_stmt FROM @sa_stt_sql;
EXECUTE sa_stt_stmt;
DEALLOCATE PREPARE sa_stt_stmt;

SET @sa_llm := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'tenants' AND column_name = 'sa_llm_provider_uid'
);
SET @sa_llm_sql := IF(@sa_llm = 0, 'ALTER TABLE tenants ADD COLUMN sa_llm_provider_uid INT NULL', 'SELECT 1');
PREPARE sa_llm_stmt FROM @sa_llm_sql;
EXECUTE sa_llm_stmt;
DEALLOCATE PREPARE sa_llm_stmt;
