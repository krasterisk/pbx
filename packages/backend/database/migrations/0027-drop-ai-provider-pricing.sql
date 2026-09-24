-- Model cost moves to a future billing module. Provider rows keep no price tail.

SET @pricing_col := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'cc_ai_providers'
    AND column_name = 'pricing'
);
SET @pricing_sql := IF(
  @pricing_col = 1,
  'ALTER TABLE cc_ai_providers DROP COLUMN pricing',
  'SELECT 1'
);
PREPARE pricing_stmt FROM @pricing_sql;
EXECUTE pricing_stmt;
DEALLOCATE PREPARE pricing_stmt;
