-- Migration: Add fallback_bot_action, max_retries_bot_action (new IVoiceRobotBotAction format)
-- and silence_timeout_seconds for slot-level silence handling.
-- Old columns fallback_action / max_retries_action (IRouteAction[] format) are preserved for backwards compat.

ALTER TABLE voice_robots
  ADD COLUMN fallback_bot_action JSON DEFAULT NULL AFTER fallback_action,
  ADD COLUMN max_retries_bot_action JSON DEFAULT NULL AFTER max_retries_action,
  ADD COLUMN silence_timeout_seconds INT DEFAULT 15 AFTER max_conversation_steps;
