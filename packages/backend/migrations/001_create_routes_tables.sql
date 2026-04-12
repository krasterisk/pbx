-- Migration: Create routes and context_includes tables for Krasterisk v4
-- Date: 2026-04-12
-- Description: Dialplan routes module — JSON-based route storage with context includes

-- Table: routes — stores dialplan routes bound to a context
CREATE TABLE IF NOT EXISTS routes (
  uid           INT AUTO_INCREMENT PRIMARY KEY,
  context_uid   INT NOT NULL,
  name          VARCHAR(255) NOT NULL DEFAULT '',
  extensions    JSON NOT NULL,                        -- ["_XXXXXXX", "_8XXXXXXXXXX"]
  priority      INT NOT NULL DEFAULT 0,               -- sort order within context
  active        TINYINT(1) NOT NULL DEFAULT 1,
  options       JSON DEFAULT NULL,                    -- { record, check_blacklist, ... }
  webhooks      JSON DEFAULT NULL,                    -- { before_dial, on_answer, ... }
  actions       JSON NOT NULL,                        -- [{ id, type, params, condition }]
  raw_dialplan  TEXT DEFAULT NULL,                     -- raw text (when edited in raw mode)
  user_uid      INT NOT NULL DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_routes_context (context_uid),
  INDEX idx_routes_user (user_uid),
  INDEX idx_routes_priority (context_uid, priority),
  CONSTRAINT fk_routes_context FOREIGN KEY (context_uid) REFERENCES contexts(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: context_includes — manages include => directives between contexts
CREATE TABLE IF NOT EXISTS context_includes (
  uid           INT AUTO_INCREMENT PRIMARY KEY,
  context_uid   INT NOT NULL,                         -- which context includes
  include_uid   INT NOT NULL,                         -- which context is included
  priority      INT NOT NULL DEFAULT 0,               -- include order
  user_uid      INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_context_include (context_uid, include_uid),
  INDEX idx_ci_context (context_uid),
  INDEX idx_ci_include (include_uid),
  CONSTRAINT fk_ci_context FOREIGN KEY (context_uid) REFERENCES contexts(uid) ON DELETE CASCADE,
  CONSTRAINT fk_ci_include FOREIGN KEY (include_uid) REFERENCES contexts(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
