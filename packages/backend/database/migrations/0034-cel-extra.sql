-- Reconcile legacy CEL installations adopted before the versioned ODBC schema.
-- Keep existing columns and events unchanged; canonical installations already have extra.
SET @cel_extra_exists := (SELECT COUNT(*) FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'cel' AND column_name = 'extra');
SET @cel_extra_ddl := IF(@cel_extra_exists = 0, 'ALTER TABLE cel ADD COLUMN extra VARCHAR(512) NULL', 'SELECT 1');
PREPARE cel_extra_stmt FROM @cel_extra_ddl;
EXECUTE cel_extra_stmt;
DEALLOCATE PREPARE cel_extra_stmt;
