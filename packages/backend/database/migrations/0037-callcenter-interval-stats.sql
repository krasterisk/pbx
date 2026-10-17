-- cc-analytics C1: 15-minute queue aggregates (additive sums, tenant-timezone agnostic: bucket = UTC quarter hour).
-- Base for the intraday chart, interval reports and later WFM. Additive only; nothing is rewritten.
CREATE TABLE IF NOT EXISTS cc_interval_queue_stats (
 uid BIGINT AUTO_INCREMENT PRIMARY KEY,
 vpbx_user_uid INTEGER NOT NULL DEFAULT 0,
 interval_start DATETIME NOT NULL,
 queue_name VARCHAR(64) NOT NULL,
 total_calls INTEGER NOT NULL DEFAULT 0,
 answered_calls INTEGER NOT NULL DEFAULT 0,
 abandoned_calls INTEGER NOT NULL DEFAULT 0,
 short_abandoned_calls INTEGER NOT NULL DEFAULT 0,
 transferred_calls INTEGER NOT NULL DEFAULT 0,
 sla_met_calls INTEGER NOT NULL DEFAULT 0,
 sla_threshold_sec INTEGER NOT NULL DEFAULT 20,
 total_wait_sec INTEGER NOT NULL DEFAULT 0,
 total_talk_sec INTEGER NOT NULL DEFAULT 0,
 total_hold_sec INTEGER NOT NULL DEFAULT 0,
 total_wrapup_sec INTEGER NOT NULL DEFAULT 0,
 max_wait_sec INTEGER NOT NULL DEFAULT 0,
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
CREATE UNIQUE INDEX uq_cc_interval_queue_tenant_start_queue ON cc_interval_queue_stats (vpbx_user_uid, interval_start, queue_name);
