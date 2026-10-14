-- Source-bound approvals for the trusted helpdesk executor. No credentials.
CREATE TABLE IF NOT EXISTS support_plans (
 id CHAR(64) PRIMARY KEY,
 tenant_uid INTEGER NOT NULL,
 principal_id CHAR(36) NOT NULL,
 permission_revision VARCHAR(24) NOT NULL,
 workflow_id CHAR(36) NULL,
 draft JSON NOT NULL,
 view_json JSON NOT NULL,
 approval_hash CHAR(64) NOT NULL,
 status VARCHAR(24) NOT NULL,
 expires_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL
);
CREATE INDEX idx_support_plans_owner ON support_plans (tenant_uid,principal_id,status);
