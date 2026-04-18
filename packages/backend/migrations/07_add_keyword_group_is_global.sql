ALTER TABLE voice_robot_keyword_groups
  ADD COLUMN is_global TINYINT NOT NULL DEFAULT 0 AFTER active;
