ALTER TABLE voice_robot_logs 
  ADD COLUMN step_number INT NOT NULL DEFAULT 0 AFTER caller_id,
  ADD COLUMN raw_stt_json JSON DEFAULT NULL AFTER recognized_text,
  ADD COLUMN audio_file_path VARCHAR(512) DEFAULT NULL AFTER raw_stt_json,
  ADD COLUMN matched_keyword_id INT DEFAULT NULL AFTER audio_file_path,
  ADD COLUMN match_confidence DECIMAL(5,2) DEFAULT NULL AFTER matched_keyword_id,
  ADD COLUMN action_taken VARCHAR(512) DEFAULT NULL AFTER match_confidence,
  ADD COLUMN stt_duration_ms INT DEFAULT NULL AFTER action_taken;
