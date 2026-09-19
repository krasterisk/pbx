CREATE TABLE ai_integration_principals (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  label VARCHAR(120) NOT NULL,
  product VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL,
  permission_revision BIGINT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_integration_principal_tenant UNIQUE (vpbx_user_uid, id)
);
CREATE INDEX idx_ai_integration_principal_catalog ON ai_integration_principals (vpbx_user_uid, product, status);

CREATE TABLE ai_integration_credentials (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  selector VARCHAR(22) NOT NULL,
  secret_digest BYTEA NOT NULL,
  predecessor_id VARCHAR(36),
  generation INTEGER NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  created_by INTEGER NOT NULL,
  CONSTRAINT uq_ai_integration_selector UNIQUE (selector),
  CONSTRAINT uq_ai_integration_generation UNIQUE (principal_id, generation),
  CONSTRAINT fk_ai_integration_credential_principal FOREIGN KEY (vpbx_user_uid, principal_id)
    REFERENCES ai_integration_principals (vpbx_user_uid, id)
);
CREATE INDEX idx_ai_integration_credential_tenant_principal ON ai_integration_credentials (vpbx_user_uid, principal_id);

CREATE TABLE ai_integration_grants (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  resource_kind VARCHAR(32) NOT NULL,
  resource_id VARCHAR(36) NOT NULL,
  scope VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_integration_grant UNIQUE (principal_id, resource_kind, resource_id, scope),
  CONSTRAINT fk_ai_integration_grant_principal FOREIGN KEY (vpbx_user_uid, principal_id)
    REFERENCES ai_integration_principals (vpbx_user_uid, id)
);
CREATE INDEX idx_ai_integration_grant_tenant_resource ON ai_integration_grants (vpbx_user_uid, resource_kind, resource_id);
CREATE INDEX idx_ai_integration_grant_principal ON ai_integration_grants (vpbx_user_uid, principal_id);

CREATE TABLE ai_integration_audit (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  actor_user_id INTEGER NOT NULL,
  action VARCHAR(32) NOT NULL,
  request_id VARCHAR(36) NOT NULL,
  metadata TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_ai_integration_audit_principal FOREIGN KEY (vpbx_user_uid, principal_id)
    REFERENCES ai_integration_principals (vpbx_user_uid, id)
);
CREATE INDEX idx_ai_integration_audit_tenant_time ON ai_integration_audit (vpbx_user_uid, created_at);
CREATE INDEX idx_ai_integration_audit_principal ON ai_integration_audit (vpbx_user_uid, principal_id);

CREATE TABLE ai_integration_commands (
  vpbx_user_uid INTEGER NOT NULL,
  actor_user_id INTEGER NOT NULL,
  operation_id VARCHAR(36) NOT NULL,
  command_hash VARCHAR(64) NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  resulting_generation INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (vpbx_user_uid, actor_user_id, operation_id),
  CONSTRAINT fk_ai_integration_command_principal FOREIGN KEY (vpbx_user_uid, principal_id)
    REFERENCES ai_integration_principals (vpbx_user_uid, id)
);
CREATE INDEX idx_ai_integration_command_principal ON ai_integration_commands (vpbx_user_uid, principal_id);
