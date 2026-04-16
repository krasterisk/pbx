-- Add display_name column to queue_table
-- Asterisk Realtime ignores unknown columns, so this is safe
ALTER TABLE queue_table ADD COLUMN display_name VARCHAR(255) DEFAULT NULL;
