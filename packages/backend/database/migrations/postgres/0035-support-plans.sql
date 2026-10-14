CREATE TABLE IF NOT EXISTS support_plans (
 id CHAR(64) PRIMARY KEY,
 tenant_uid INTEGER NOT NULL,
 principal_id CHAR(36) NOT NULL,
 permission_revision VARCHAR(24) NOT NULL,
 workflow_id CHAR(36) NULL,
 draft JSONB NOT NULL,
 view_json JSONB NOT NULL,
 approval_hash CHAR(64) NOT NULL,
 status VARCHAR(24) NOT NULL,
 expires_at TIMESTAMP NOT NULL,
 updated_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_plans_owner ON support_plans (tenant_uid,principal_id,status);
