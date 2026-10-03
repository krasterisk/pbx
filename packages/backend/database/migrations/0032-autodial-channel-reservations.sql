-- Adopt installations where the legacy startup hook already added these columns.
SET @ac_column_exists := (SELECT COUNT(*) FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'ac_campaigns' AND column_name = 'applied_revision');
SET @ac_ddl := IF(@ac_column_exists = 0, 'ALTER TABLE ac_campaigns ADD COLUMN applied_revision INT NULL', 'SELECT 1');
PREPARE ac_stmt FROM @ac_ddl;
EXECUTE ac_stmt;
DEALLOCATE PREPARE ac_stmt;

SET @ac_column_exists := (SELECT COUNT(*) FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'ac_campaigns' AND column_name = 'apply_error');
SET @ac_ddl := IF(@ac_column_exists = 0, 'ALTER TABLE ac_campaigns ADD COLUMN apply_error VARCHAR(255) NULL', 'SELECT 1');
PREPARE ac_stmt FROM @ac_ddl;
EXECUTE ac_stmt;
DEALLOCATE PREPARE ac_stmt;

SET @ac_column_exists := (SELECT COUNT(*) FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'ac_campaigns' AND column_name = 'pacer_owner');
SET @ac_ddl := IF(@ac_column_exists = 0, 'ALTER TABLE ac_campaigns ADD COLUMN pacer_owner VARCHAR(64) NULL', 'SELECT 1');
PREPARE ac_stmt FROM @ac_ddl;
EXECUTE ac_stmt;
DEALLOCATE PREPARE ac_stmt;

SET @ac_column_exists := (SELECT COUNT(*) FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'ac_campaigns' AND column_name = 'pacer_heartbeat_at');
SET @ac_ddl := IF(@ac_column_exists = 0, 'ALTER TABLE ac_campaigns ADD COLUMN pacer_heartbeat_at DATETIME NULL', 'SELECT 1');
PREPARE ac_stmt FROM @ac_ddl;
EXECUTE ac_stmt;
DEALLOCATE PREPARE ac_stmt;

UPDATE ac_campaigns SET applied_revision = revision WHERE applied_revision IS NULL;
CREATE TABLE IF NOT EXISTS ac_channel_reservations (
 uid INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 vpbx_user_uid INT NOT NULL,
 campaign_uid INT NOT NULL,
 task_uid INT NOT NULL,
 trunk_id VARCHAR(128) NOT NULL,
 owner VARCHAR(64) NOT NULL,
 expires_at DATETIME NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_ac_res_task (task_uid),
 KEY idx_ac_res_trunk (vpbx_user_uid, trunk_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
