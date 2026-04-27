-- Add custom tag column to voice_robot_keywords
-- When set, this tag is used in visitedTags/CDR instead of the group name
ALTER TABLE voice_robot_keywords
  ADD COLUMN tag VARCHAR(255) NULL DEFAULT NULL AFTER comment;
