-- Migration: Add repeat counter & escalation action to voice_robot_keywords
-- Allows a keyword scenario to fire a different action after N repeated matches.
-- max_repeats = 0 means unlimited (no escalation).

ALTER TABLE voice_robot_keywords
  ADD COLUMN IF NOT EXISTS max_repeats INTEGER NOT NULL DEFAULT 0;

ALTER TABLE voice_robot_keywords
  ADD COLUMN IF NOT EXISTS escalation_action JSON DEFAULT NULL;
