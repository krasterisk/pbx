CREATE TABLE ai_integration_principals (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  label VARCHAR(120) NOT NULL,
  product VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL,
  permission_revision BIGINT NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_integration_principal_tenant (vpbx_user_uid, id),
  KEY idx_ai_integration_principal_catalog (vpbx_user_uid, product, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_integration_credentials (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  selector VARCHAR(22) NOT NULL,
  secret_digest BINARY(32) NOT NULL,
  predecessor_id VARCHAR(36) NULL,
  generation INT NOT NULL,
  expires_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_integration_selector (selector),
  UNIQUE KEY uq_ai_integration_generation (principal_id, generation),
  KEY idx_ai_integration_credential_tenant_principal (vpbx_user_uid, principal_id),
  CONSTRAINT fk_ai_integration_credential_principal FOREIGN KEY (vpbx_user_uid, principal_id)
    REFERENCES ai_integration_principals(vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_integration_grants (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  resource_kind VARCHAR(32) NOT NULL,
  resource_id VARCHAR(36) NOT NULL,
  scope VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_integration_grant (principal_id, resource_kind, resource_id, scope),
  KEY idx_ai_integration_grant_tenant_resource (vpbx_user_uid, resource_kind, resource_id),
  KEY idx_ai_integration_grant_principal (vpbx_user_uid, principal_id),
  CONSTRAINT fk_ai_integration_grant_principal FOREIGN KEY (vpbx_user_uid, principal_id)
    REFERENCES ai_integration_principals(vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_integration_audit (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  actor_user_id INT NOT NULL,
  action VARCHAR(32) NOT NULL,
  request_id VARCHAR(36) NOT NULL,
  metadata TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_ai_integration_audit_tenant_time (vpbx_user_uid, created_at),
  KEY idx_ai_integration_audit_principal (vpbx_user_uid, principal_id),
  CONSTRAINT fk_ai_integration_audit_principal FOREIGN KEY (vpbx_user_uid, principal_id)
    REFERENCES ai_integration_principals(vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_integration_commands (
  vpbx_user_uid INT NOT NULL,
  actor_user_id INT NOT NULL,
  operation_id VARCHAR(36) NOT NULL,
  command_hash VARCHAR(64) NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  resulting_generation INT NOT NULL,
  completed_at DATETIME(3) NOT NULL,
  PRIMARY KEY (vpbx_user_uid, actor_user_id, operation_id),
  KEY idx_ai_integration_command_principal (vpbx_user_uid, principal_id),
  CONSTRAINT fk_ai_integration_command_principal FOREIGN KEY (vpbx_user_uid, principal_id)
    REFERENCES ai_integration_principals(vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
