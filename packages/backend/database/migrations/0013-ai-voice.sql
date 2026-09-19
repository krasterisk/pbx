CREATE TABLE IF NOT EXISTS cc_ai_agents (
  uid INTEGER NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  unique_id VARCHAR(64) NOT NULL,
  mode ENUM('realtime', 'cascade') NOT NULL DEFAULT 'realtime',
  voice VARCHAR(64) DEFAULT '',
  greeting TEXT,
  instruction MEDIUMTEXT,
  model_profile_id INTEGER,
  stt_profile_id INTEGER,
  tts_profile_id INTEGER,
  vad_config JSON,
  toolset_id INTEGER,
  channel_kind ENUM('local', 'pjsip') NOT NULL DEFAULT 'local',
  enabled TINYINT(1) NOT NULL DEFAULT true,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  vpbx_user_uid INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE ai_robot_drafts (
  vpbx_user_uid INT NOT NULL,
  agent_uid INT NOT NULL,
  robot_uuid VARCHAR(36) NOT NULL,
  draft_revision INT NOT NULL,
  runtime_policy TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (vpbx_user_uid, agent_uid),
  UNIQUE KEY uq_ai_robot_draft_uuid (robot_uuid),
  UNIQUE KEY uq_ai_robot_draft_tenant_uuid (vpbx_user_uid, robot_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_robot_versions (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  agent_uid INT NOT NULL,
  version_no INT NOT NULL,
  config_digest CHAR(64) NOT NULL,
  config TEXT NOT NULL,
  llm_revision_id VARCHAR(36) NOT NULL,
  stt_revision_id VARCHAR(36) NULL,
  tts_revision_id VARCHAR(36) NULL,
  created_by INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_robot_version_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_robot_version_no (agent_uid, version_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_robot_deployments (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  agent_uid INT NOT NULL,
  kind VARCHAR(32) NOT NULL,
  active_version_id VARCHAR(36) NULL,
  status VARCHAR(32) NOT NULL,
  revision INT NOT NULL,
  capture_policy TEXT NOT NULL,
  fallback_policy TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_robot_deployment_tenant (vpbx_user_uid, id),
  CONSTRAINT chk_ai_robot_deployment_kind CHECK (kind IN ('internal','browser_test','external_sip')),
  CONSTRAINT chk_ai_robot_deployment_status CHECK (status IN ('disabled','ready','draining','stopped')),
  CONSTRAINT chk_ai_robot_deployment_sip CHECK (kind <> 'external_sip' OR status <> 'ready'),
  CONSTRAINT fk_ai_robot_deployment_version FOREIGN KEY (vpbx_user_uid, active_version_id)
    REFERENCES ai_robot_versions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_voice_sessions (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  deployment_id VARCHAR(36) NOT NULL,
  version_id VARCHAR(36) NOT NULL,
  ingress_kind VARCHAR(32) NOT NULL,
  ingress_key VARCHAR(128) NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  channel_uniqueid VARCHAR(128) NULL,
  owner VARCHAR(64) NOT NULL,
  fence BIGINT NOT NULL,
  state VARCHAR(32) NOT NULL,
  reason VARCHAR(64) NULL,
  capture_intent_id VARCHAR(36) NULL,
  usage_reservation_id VARCHAR(36) NULL,
  started_at DATETIME(3) NOT NULL,
  ended_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_voice_session_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_voice_session_ingress (ingress_kind, ingress_key),
  CONSTRAINT chk_ai_voice_session_kind CHECK (ingress_kind IN ('native','browser_test','autodial')),
  CONSTRAINT chk_ai_voice_session_state CHECK (state IN (
    'admitted','listening','thinking','speaking','fallback','completed','failed','cancelled')),
  CONSTRAINT fk_ai_voice_session_deployment FOREIGN KEY (vpbx_user_uid, deployment_id)
    REFERENCES ai_robot_deployments (vpbx_user_uid, id),
  CONSTRAINT fk_ai_voice_session_version FOREIGN KEY (vpbx_user_uid, version_id)
    REFERENCES ai_robot_versions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_voice_turns (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  input_turn_id INT NOT NULL,
  output_epoch INT NOT NULL,
  role VARCHAR(16) NOT NULL,
  state VARCHAR(32) NOT NULL,
  text TEXT NOT NULL,
  provenance VARCHAR(32) NOT NULL,
  started_ms BIGINT NOT NULL,
  ended_ms BIGINT NULL,
  played_until_ms BIGINT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_voice_turn_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_voice_turn_key (session_id, input_turn_id, role, output_epoch),
  CONSTRAINT chk_ai_voice_turn_role CHECK (role IN ('caller','assistant')),
  CONSTRAINT chk_ai_voice_turn_state CHECK (state IN ('provisional','final','interrupted')),
  CONSTRAINT fk_ai_voice_turn_session FOREIGN KEY (vpbx_user_uid, session_id)
    REFERENCES ai_voice_sessions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_voice_events (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  sequence INT NOT NULL,
  type VARCHAR(64) NOT NULL,
  payload TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_voice_event_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_voice_event_seq (session_id, sequence),
  CONSTRAINT fk_ai_voice_event_session FOREIGN KEY (vpbx_user_uid, session_id)
    REFERENCES ai_voice_sessions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_call_control_operations (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  operation_key VARCHAR(64) NOT NULL,
  action VARCHAR(32) NOT NULL,
  target_ref VARCHAR(128) NULL,
  state VARCHAR(32) NOT NULL,
  observed_result VARCHAR(32) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_call_control_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_call_control_op (session_id, operation_key),
  CONSTRAINT chk_ai_call_control_action CHECK (action IN ('end_call','transfer','get_session_context')),
  CONSTRAINT chk_ai_call_control_state CHECK (state IN ('requested','confirmed','failed','cancelled')),
  CONSTRAINT fk_ai_call_control_session FOREIGN KEY (vpbx_user_uid, session_id)
    REFERENCES ai_voice_sessions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_voice_tickets (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  channel_uniqueid VARCHAR(128) NOT NULL,
  deployment_id VARCHAR(36) NOT NULL,
  digest CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_voice_ticket_tenant (vpbx_user_uid, id),
  CONSTRAINT fk_ai_voice_ticket_deployment FOREIGN KEY (vpbx_user_uid, deployment_id)
    REFERENCES ai_robot_deployments (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
