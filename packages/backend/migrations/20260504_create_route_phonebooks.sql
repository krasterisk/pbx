-- Route Phonebooks: collections of phone numbers with dialplan actions
-- Used for CallerID matching in route dialplan (Gosub/Return pattern)

CREATE TABLE IF NOT EXISTS route_phonebooks (
  uid           INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  description   VARCHAR(255) DEFAULT '',
  invert        TINYINT(1) DEFAULT 0 COMMENT 'If 1, actions fire on NON-match',
  actions       JSON DEFAULT NULL COMMENT 'IRouteAction[] — dialplan actions on match',
  user_uid      INT NOT NULL DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phonebook_user (user_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS route_phonebook_entries (
  uid           INT AUTO_INCREMENT PRIMARY KEY,
  phonebook_uid INT NOT NULL,
  number        VARCHAR(32) NOT NULL COMMENT 'Phone number or pattern',
  label         VARCHAR(100) DEFAULT '' COMMENT 'Optional description',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entry_phonebook (phonebook_uid),
  INDEX idx_entry_number (number),
  FOREIGN KEY (phonebook_uid) REFERENCES route_phonebooks(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
