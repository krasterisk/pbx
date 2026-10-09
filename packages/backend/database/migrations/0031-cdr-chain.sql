-- uniqueid identifies a channel; transfers may create several CDR records for it.
-- Live Asterisk cdr often has no PRIMARY KEY. Baseline 0001 uses PRIMARY KEY (uniqueid).
-- Drop that key only when it exists and is not already the surrogate id.

SET @cdr_pk_not_id := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'cdr'
    AND index_name = 'PRIMARY'
    AND column_name <> 'id'
);
SET @cdr_drop_pk_sql := IF(@cdr_pk_not_id > 0, 'ALTER TABLE cdr DROP PRIMARY KEY', 'SELECT 1');
PREPARE cdr_drop_pk_stmt FROM @cdr_drop_pk_sql;
EXECUTE cdr_drop_pk_stmt;
DEALLOCATE PREPARE cdr_drop_pk_stmt;

SET @cdr_id_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'cdr'
    AND column_name = 'id'
);
SET @cdr_add_id_sql := IF(
  @cdr_id_exists = 0,
  'ALTER TABLE cdr ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST',
  'SELECT 1'
);
PREPARE cdr_add_id_stmt FROM @cdr_add_id_sql;
EXECUTE cdr_add_id_stmt;
DEALLOCATE PREPARE cdr_add_id_stmt;

SET @cdr_pk_exists := (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'cdr'
    AND constraint_type = 'PRIMARY KEY'
);
SET @cdr_id_ready := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'cdr'
    AND column_name = 'id'
);
SET @cdr_add_pk_sql := IF(
  @cdr_pk_exists = 0 AND @cdr_id_ready = 1,
  'ALTER TABLE cdr ADD PRIMARY KEY (id)',
  'SELECT 1'
);
PREPARE cdr_add_pk_stmt FROM @cdr_add_pk_sql;
EXECUTE cdr_add_pk_stmt;
DEALLOCATE PREPARE cdr_add_pk_stmt;

SET @cdr_uidx := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'cdr'
    AND index_name = 'idx_cdr_uniqueid'
);
SET @cdr_uidx_sql := IF(@cdr_uidx = 0, 'ALTER TABLE cdr ADD KEY idx_cdr_uniqueid (uniqueid)', 'SELECT 1');
PREPARE cdr_uidx_stmt FROM @cdr_uidx_sql;
EXECUTE cdr_uidx_stmt;
DEALLOCATE PREPARE cdr_uidx_stmt;

SET @cel_idx := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'cel'
    AND index_name = 'idx_cel_linkedid_eventtime'
);
SET @cel_idx_sql := IF(
  @cel_idx = 0,
  'CREATE INDEX idx_cel_linkedid_eventtime ON cel (linkedid, eventtime, id)',
  'SELECT 1'
);
PREPARE cel_idx_stmt FROM @cel_idx_sql;
EXECUTE cel_idx_stmt;
DEALLOCATE PREPARE cel_idx_stmt;

CREATE TABLE IF NOT EXISTS ps_domain_aliases (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  domain VARCHAR(80) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
