-- Additive full-PBX dashboard schema (epoch milliseconds are portable).
ALTER TABLE tenants ADD COLUMN plan_name VARCHAR(128) NULL;
ALTER TABLE tenants ADD COLUMN plan_expires_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE tenants ADD COLUMN max_concurrent_calls INTEGER NULL;
ALTER TABLE tenants ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'UTC';
CREATE TABLE IF NOT EXISTS dashboard_calls (
 call_key CHAR(64) PRIMARY KEY, tenant BIGINT NOT NULL, node_id VARCHAR(80) NOT NULL,
 linkedid VARCHAR(128) NOT NULL, started_at BIGINT NOT NULL, ended_at BIGINT NULL,
 src VARCHAR(128) NOT NULL, dst VARCHAR(128) NOT NULL, direction VARCHAR(16) NOT NULL,
 origin VARCHAR(16) NOT NULL, outcome VARCHAR(16) NOT NULL, reason VARCHAR(80) NULL,
 duration INTEGER NOT NULL, fingerprint CHAR(64) NOT NULL, updated_at BIGINT NOT NULL
);
CREATE INDEX idx_dashboard_calls_period ON dashboard_calls (tenant, started_at, call_key);
CREATE INDEX idx_dashboard_calls_chain ON dashboard_calls (tenant, node_id, linkedid);
CREATE INDEX idx_dashboard_calls_pending ON dashboard_calls (node_id, ended_at, call_key);
CREATE INDEX idx_dashboard_calls_node_key ON dashboard_calls (node_id, call_key);
CREATE TABLE IF NOT EXISTS dashboard_participants (
 call_key CHAR(64) NOT NULL, tenant BIGINT NOT NULL, kind VARCHAR(16) NOT NULL, value VARCHAR(128) NOT NULL,
 PRIMARY KEY (call_key, kind, value)
);
CREATE INDEX idx_dashboard_acl ON dashboard_participants (tenant, kind, value, call_key);
CREATE TABLE IF NOT EXISTS dashboard_buckets (
 tenant BIGINT NOT NULL, node_id VARCHAR(80) NOT NULL, bucket_at BIGINT NOT NULL,
 direction VARCHAR(16) NOT NULL, origin VARCHAR(16) NOT NULL, outcome VARCHAR(16) NOT NULL,
 call_count BIGINT NOT NULL DEFAULT 0,
 PRIMARY KEY (tenant, node_id, bucket_at, direction, origin, outcome)
);
CREATE TABLE IF NOT EXISTS dashboard_checkpoints (
 source_key VARCHAR(160) PRIMARY KEY, cursor_value BIGINT NOT NULL DEFAULT 0,
 cursor_key VARCHAR(128) NULL, initialized_from BIGINT NOT NULL, bootstrap_complete INTEGER NOT NULL DEFAULT 0, updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS dashboard_leases (
 lease_key VARCHAR(160) PRIMARY KEY, owner VARCHAR(80) NOT NULL, expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS dashboard_live_state (
 node_id VARCHAR(80) PRIMARY KEY, payload TEXT NOT NULL, updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS dashboard_system_samples (
 node_id VARCHAR(64) NOT NULL, sampled_at BIGINT NOT NULL, payload TEXT NOT NULL,
 PRIMARY KEY (node_id, sampled_at)
);
CREATE INDEX idx_dashboard_samples_retention ON dashboard_system_samples (sampled_at);


-- Indexed bounded source lookup for background projection.
CREATE INDEX idx_dashboard_cdr_tenant_chain ON cdr (vpbx_user_uid, linkedid, id);
CREATE INDEX idx_dashboard_cdr_chain ON cdr (linkedid, id);
CREATE INDEX idx_dashboard_cel_chain ON cel (linkedid, id);
CREATE INDEX idx_dashboard_robot_cdr ON voice_robot_cdr (user_uid, call_uniqueid, uid);
CREATE INDEX idx_dashboard_robot_logs ON voice_robot_logs (user_uid, call_uniqueid, uid);
CREATE INDEX idx_dashboard_ai_sessions ON ai_voice_sessions (vpbx_user_uid, channel_uniqueid);
CREATE INDEX idx_dashboard_ai_events ON ai_voice_events (created_at, id);
CREATE INDEX idx_dashboard_ai_turns ON ai_voice_turns (vpbx_user_uid, session_id, role);
