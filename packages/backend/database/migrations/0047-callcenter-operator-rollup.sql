-- Operator scorecard. Additive. The report itself reads cc_queue_calls (grouped) and the agent journal;
-- these daily tables keep a queue split and journal time for ranges that should not scan raw rows.
CREATE TABLE IF NOT EXISTS cc_daily_agent_queue_stats (
  uid BIGINT AUTO_INCREMENT PRIMARY KEY,
  stat_date DATE NOT NULL,
  agent_user_uid INTEGER NULL,
  agent_interface VARCHAR(64) NOT NULL DEFAULT '',
  queue_name VARCHAR(64) NOT NULL DEFAULT '',
  calls_handled INTEGER NOT NULL DEFAULT 0,
  total_talk_sec INTEGER NOT NULL DEFAULT 0,
  total_hold_sec INTEGER NOT NULL DEFAULT 0,
  total_wrapup_sec INTEGER NOT NULL DEFAULT 0,
  transferred_calls INTEGER NOT NULL DEFAULT 0,
  short_calls INTEGER NOT NULL DEFAULT 0,
  rna_count INTEGER NOT NULL DEFAULT 0,
  outbound_calls INTEGER NOT NULL DEFAULT 0,
  outbound_answered INTEGER NOT NULL DEFAULT 0,
  outbound_talk_sec INTEGER NOT NULL DEFAULT 0,
  vpbx_user_uid INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
CREATE UNIQUE INDEX uq_cc_daily_agent_queue ON cc_daily_agent_queue_stats (vpbx_user_uid, stat_date, agent_user_uid, agent_interface, queue_name);
CREATE TABLE IF NOT EXISTS cc_daily_agent_time_stats (
  uid BIGINT AUTO_INCREMENT PRIMARY KEY,
  stat_date DATE NOT NULL,
  agent_user_uid INTEGER NULL,
  agent_interface VARCHAR(64) NOT NULL DEFAULT '',
  logged_in_sec INTEGER NOT NULL DEFAULT 0,
  ready_sec INTEGER NOT NULL DEFAULT 0,
  busy_sec INTEGER NOT NULL DEFAULT 0,
  pause_paid_sec INTEGER NOT NULL DEFAULT 0,
  pause_unpaid_sec INTEGER NOT NULL DEFAULT 0,
  pause_unknown_sec INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  first_login DATETIME NULL,
  last_logout DATETIME NULL,
  queues VARCHAR(512) NOT NULL DEFAULT '',
  vpbx_user_uid INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
CREATE UNIQUE INDEX uq_cc_daily_agent_time ON cc_daily_agent_time_stats (vpbx_user_uid, stat_date, agent_user_uid, agent_interface);
CREATE INDEX idx_cc_queue_calls_tenant_created ON cc_queue_calls (vpbx_user_uid, created_at);
CREATE INDEX idx_cc_queue_calls_tenant_agent_created ON cc_queue_calls (vpbx_user_uid, agent_user_uid, created_at);
CREATE INDEX idx_cc_agent_sessions_tenant_login ON cc_agent_sessions (vpbx_user_uid, login_time);
CREATE INDEX idx_cc_agent_events_session_time ON cc_agent_events (session_id, created_at);
