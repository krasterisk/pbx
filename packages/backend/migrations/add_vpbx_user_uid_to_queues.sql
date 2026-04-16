-- Migration: Add vpbx_user_uid to queue_table and queue_member_table
-- Run this on Asterisk Realtime MySQL database

-- Add vpbx_user_uid to queue_table (if not exists)
ALTER TABLE queue_table
  ADD COLUMN IF NOT EXISTS vpbx_user_uid INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_queue_table_vpbx_user_uid ON queue_table(vpbx_user_uid);

-- Add vpbx_user_uid to queue_member_table (if not exists)
ALTER TABLE queue_member_table
  ADD COLUMN IF NOT EXISTS vpbx_user_uid INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_queue_member_table_vpbx_user_uid ON queue_member_table(vpbx_user_uid);
