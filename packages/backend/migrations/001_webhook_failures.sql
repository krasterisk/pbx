-- Migration: create webhook_failures table
-- Run once on production server:
--   mysql -u krasterisk -p krasterisk < migrations/001_webhook_failures.sql
--
-- Table stores failed webhook delivery attempts after all BullMQ retry attempts exhausted.
-- Allows admin to view, retry, or dismiss failed deliveries via System Settings UI.

CREATE TABLE IF NOT EXISTS `webhook_failures` (
  `id`          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  `route_uid`   VARCHAR(64)       NOT NULL COMMENT 'Route UID from HH_ROUTE_UID dialplan variable',
  `event`       VARCHAR(32)       NOT NULL COMMENT 'Event type: before_dial | on_answer | on_hangup | custom',
  `url`         VARCHAR(512)      NOT NULL COMMENT 'Target URL that failed',
  `payload`     JSON              NOT NULL COMMENT 'Full payload for retry',
  `headers`     JSON              NOT NULL COMMENT 'Pre-built auth/signature headers for retry',
  `error`       TEXT                  NULL COMMENT 'Last error message from final failed attempt',
  `attempts`    TINYINT UNSIGNED  NOT NULL DEFAULT 3 COMMENT 'Number of delivery attempts made',
  `failed_at`   DATETIME          NOT NULL DEFAULT NOW() COMMENT 'Timestamp of final failure',
  `retried_at`  DATETIME              NULL COMMENT 'Set when admin manually retried',
  `resolved`    TINYINT(1)        NOT NULL DEFAULT 0 COMMENT '1 = successfully re-delivered or dismissed',
  PRIMARY KEY (`id`),
  KEY `idx_route_uid` (`route_uid`),
  KEY `idx_event` (`event`),
  KEY `idx_resolved_failed_at` (`resolved`, `failed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dead-letter store for failed BullMQ webhook delivery jobs';
