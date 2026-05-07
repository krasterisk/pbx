-- Migration: add status column to action_logs table
-- Run once on production server:
--   mysql -u krasterisk -p krasterisk < migrations/002_action_logs_status.sql

ALTER TABLE `action_logs`
  ADD COLUMN `status` VARCHAR(16) NOT NULL DEFAULT 'success' AFTER `details`,
  ADD INDEX `idx_user_uid_status` (`vpbx_user_uid`, `status`),
  ADD INDEX `idx_user_uid_created` (`vpbx_user_uid`, `created_at`);
