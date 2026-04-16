-- Migration: Add bot_action JSON column to voice_robot_keywords
-- This stores the new IVoiceRobotBotAction format alongside the legacy `actions` column.
-- The legacy `actions` column (IRouteAction[]) is preserved for backwards compatibility.

ALTER TABLE voice_robot_keywords
  ADD COLUMN bot_action JSON DEFAULT NULL AFTER actions;

-- Add match_method column to logs for tracking levenshtein vs semantic matching
ALTER TABLE voice_robot_logs
  ADD COLUMN match_method VARCHAR(32) DEFAULT NULL AFTER match_confidence;
