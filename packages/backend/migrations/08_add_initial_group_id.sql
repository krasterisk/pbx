ALTER TABLE voice_robots
  ADD COLUMN initial_group_id INT DEFAULT NULL AFTER greeting_tts_text;
