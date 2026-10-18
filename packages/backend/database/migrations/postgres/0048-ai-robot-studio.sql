ALTER TABLE ai_robot_drafts ADD COLUMN config_json TEXT NULL;
ALTER TABLE ai_robot_drafts ADD COLUMN config_schema_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ai_robot_drafts ADD COLUMN current_version_id VARCHAR(36) NULL;
ALTER TABLE ai_robot_versions ADD COLUMN operation_key VARCHAR(64) NULL;
CREATE INDEX ix_ai_robot_version_operation ON ai_robot_versions (agent_uid, operation_key);
CREATE UNIQUE INDEX uq_cc_ai_agents_tenant_unique ON cc_ai_agents (vpbx_user_uid, unique_id);
ALTER TABLE ai_voice_sessions ADD COLUMN robot_uid INTEGER NULL;
ALTER TABLE ai_voice_sessions ADD COLUMN outcome VARCHAR(64) NULL;
ALTER TABLE ai_voice_sessions ADD COLUMN extracted_json TEXT NULL;
ALTER TABLE ai_voice_sessions ADD COLUMN metrics_json TEXT NULL;
ALTER TABLE ai_voice_sessions ADD COLUMN recording_ref VARCHAR(256) NULL;
ALTER TABLE ai_business_connections ADD COLUMN config_json TEXT NULL;
ALTER TABLE ai_business_connections ADD COLUMN credential_ref VARCHAR(128) NULL;
ALTER TABLE ai_business_connections ADD COLUMN description VARCHAR(512) NULL;
ALTER TABLE ai_business_connections ADD COLUMN side_effect VARCHAR(32) NULL;
CREATE TABLE ai_robot_test_cases (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  agent_uid INTEGER NOT NULL,
  name VARCHAR(128) NOT NULL,
  scenario_json TEXT NOT NULL,
  last_result_json TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
