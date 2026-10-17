-- cc-analytics phase A: one metrics truth. Additive only; no existing data is rewritten.
-- Ring-No-Answer attempts leave cc_queue_calls (they are offers to an agent, not calls).
CREATE TABLE IF NOT EXISTS cc_agent_offers (
 uid BIGINT AUTO_INCREMENT PRIMARY KEY,
 call_uniqueid VARCHAR(64) NOT NULL,
 queue_name VARCHAR(64) NOT NULL,
 agent_interface VARCHAR(64) NOT NULL DEFAULT '',
 agent_user_uid INTEGER NULL,
 caller_id_num VARCHAR(32) NOT NULL DEFAULT '',
 outcome VARCHAR(16) NOT NULL DEFAULT 'rna',
 ring_time INTEGER NOT NULL DEFAULT 0,
 offered_at DATETIME NOT NULL,
 created_at DATETIME NOT NULL,
 vpbx_user_uid INTEGER NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
CREATE INDEX idx_cc_agent_offers_tenant_time ON cc_agent_offers (vpbx_user_uid, offered_at);
CREATE INDEX idx_cc_agent_offers_tenant_agent ON cc_agent_offers (vpbx_user_uid, agent_user_uid, offered_at);
-- Rollup stores additive sums (not averages) plus the per-queue SLA threshold used for the day.
ALTER TABLE cc_daily_queue_stats ADD COLUMN transferred_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cc_daily_queue_stats ADD COLUMN short_abandoned_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cc_daily_queue_stats ADD COLUMN sla_threshold_sec INTEGER NOT NULL DEFAULT 20;
ALTER TABLE cc_daily_queue_stats ADD COLUMN total_wait_sec INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cc_daily_queue_stats ADD COLUMN total_hold_sec INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cc_daily_queue_stats ADD COLUMN total_wrapup_sec INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cc_daily_queue_stats ADD COLUMN rollup_version INTEGER NOT NULL DEFAULT 1;
-- Tenant rule for short abandons (R2): abandon within N seconds is excluded from offered. 0 disables.
ALTER TABLE cc_settings ADD COLUMN short_abandon_sec INTEGER NOT NULL DEFAULT 5;
