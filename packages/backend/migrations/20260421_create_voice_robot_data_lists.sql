-- Voice Robot Data Lists — structured lookup tables for hybrid search
-- Part of the Voice Robots module (search_data_list action)

CREATE TABLE IF NOT EXISTS `voice_robot_data_lists` (
  `uid` INT AUTO_INCREMENT PRIMARY KEY,
  `robot_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `columns` JSON NOT NULL COMMENT 'Array of {key, label, searchable}',
  `rows` JSON NOT NULL COMMENT 'Array of {[key]: value} objects',
  `user_uid` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_robot_id` (`robot_id`),
  INDEX `idx_user_uid` (`user_uid`),
  CONSTRAINT `fk_datalist_robot` FOREIGN KEY (`robot_id`)
    REFERENCES `voice_robots` (`uid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
