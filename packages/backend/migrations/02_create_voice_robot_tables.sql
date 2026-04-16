-- Voice Robots module tables
-- Run AFTER voice_robots table already exists

CREATE TABLE IF NOT EXISTS voice_robot_keyword_groups (
  uid INT AUTO_INCREMENT PRIMARY KEY,
  robot_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  priority INT NOT NULL DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1,
  user_uid INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_keyword_group_robot FOREIGN KEY (robot_id) REFERENCES voice_robots(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add description column if missing (for tables created before this migration)
-- MySQL 8.0.1+ supports ALTER TABLE ... IF NOT EXISTS, for older versions this may error — safe to ignore.

CREATE TABLE IF NOT EXISTS voice_robot_keywords (
  uid INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  keywords TEXT NOT NULL,
  negative_keywords JSON DEFAULT NULL,
  synonyms JSON DEFAULT NULL,
  actions JSON DEFAULT NULL,
  priority INT NOT NULL DEFAULT 0,
  comment VARCHAR(512) DEFAULT NULL,
  user_uid INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_keyword_group FOREIGN KEY (group_id) REFERENCES voice_robot_keyword_groups(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS voice_robot_logs (
  uid BIGINT AUTO_INCREMENT PRIMARY KEY,
  robot_id INT NOT NULL,
  call_uniqueid VARCHAR(128) DEFAULT NULL,
  caller_id VARCHAR(128) DEFAULT NULL,
  step_number INT NOT NULL DEFAULT 0,
  recognized_text TEXT DEFAULT NULL,
  raw_stt_json JSON DEFAULT NULL,
  audio_file_path VARCHAR(512) DEFAULT NULL,
  matched_keyword_id INT DEFAULT NULL,
  match_confidence DECIMAL(5,2) DEFAULT NULL,
  action_taken VARCHAR(512) DEFAULT NULL,
  stt_duration_ms INT DEFAULT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_uid INT NOT NULL DEFAULT 0,
  INDEX idx_robot_id (robot_id),
  INDEX idx_user_uid (user_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
