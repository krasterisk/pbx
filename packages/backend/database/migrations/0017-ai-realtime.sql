CREATE TABLE ai_sip_connections (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  transport VARCHAR(16) NOT NULL,
  auth_kind VARCHAR(32) NOT NULL,
  draft_revision INT NOT NULL,
  secret_once_shown TINYINT(1) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_sip_conn_tenant (vpbx_user_uid, id),
  CONSTRAINT chk_ai_sip_conn_status CHECK (status IN ('draft','ready','revoked','failed')),
  CONSTRAINT chk_ai_sip_conn_transport CHECK (transport IN ('udp','tcp','tls'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_sip_config_revisions (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  connection_id VARCHAR(36) NOT NULL,
  revision INT NOT NULL,
  config_digest CHAR(64) NOT NULL,
  config TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_sip_rev_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_sip_rev_no (connection_id, revision),
  CONSTRAINT chk_ai_sip_rev_status CHECK (status IN ('draft','applied','failed','superseded')),
  CONSTRAINT fk_ai_sip_rev_conn FOREIGN KEY (vpbx_user_uid, connection_id)
    REFERENCES ai_sip_connections (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_sip_did_bindings (
  vpbx_user_uid INT NOT NULL,
  connection_id VARCHAR(36) NOT NULL,
  did VARCHAR(64) NOT NULL,
  deployment_id VARCHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (connection_id, did),
  UNIQUE KEY uq_ai_sip_did_tenant (vpbx_user_uid, connection_id, did),
  CONSTRAINT chk_ai_sip_did_status CHECK (status IN ('active','disabled')),
  CONSTRAINT fk_ai_sip_did_conn FOREIGN KEY (vpbx_user_uid, connection_id)
    REFERENCES ai_sip_connections (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_voice_invocations (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  deployment_id VARCHAR(36) NOT NULL,
  principal VARCHAR(64) NOT NULL,
  external_call_id VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  session_id VARCHAR(36) NULL,
  destination_ref VARCHAR(128) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_voice_inv_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_voice_inv_biz (vpbx_user_uid, principal, deployment_id, external_call_id),
  CONSTRAINT chk_ai_voice_inv_status CHECK (status IN (
    'accepted','originating','ringing','answered','failed','outcome_unknown','cancelled')),
  CONSTRAINT fk_ai_voice_inv_dep FOREIGN KEY (vpbx_user_uid, deployment_id)
    REFERENCES ai_robot_deployments (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
