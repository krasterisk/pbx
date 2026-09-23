-- Global model catalog shares cc_ai_providers with tenant connections.
-- is_global = 1 rows are superadmin-owned and hidden from cabinet lists.

SET @global_col := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'cc_ai_providers'
    AND column_name = 'is_global'
);
SET @global_sql := IF(
  @global_col = 0,
  'ALTER TABLE cc_ai_providers ADD COLUMN is_global TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE global_stmt FROM @global_sql;
EXECUTE global_stmt;
DEALLOCATE PREPARE global_stmt;
