CREATE TABLE ai_product_activation (
  vpbx_user_uid INTEGER NOT NULL,
  product VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  revision INTEGER NOT NULL DEFAULT 1,
  actor_user_id INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (vpbx_user_uid, product)
);

CREATE TABLE ai_local_license_documents (
  uid VARCHAR(36) NOT NULL PRIMARY KEY,
  license_id VARCHAR(36) NOT NULL,
  revision INTEGER NOT NULL,
  vpbx_user_uid INTEGER NOT NULL,
  installation_id VARCHAR(128) NOT NULL,
  payload_bytes BYTEA NOT NULL,
  signature_bytes BYTEA NOT NULL,
  digest_sha256 VARCHAR(64) NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL,
  imported_by INTEGER NOT NULL,
  max_observed_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_license_revision UNIQUE (license_id, revision)
);
CREATE INDEX idx_ai_license_tenant ON ai_local_license_documents (vpbx_user_uid);

CREATE TABLE ai_local_license_bindings (
  vpbx_user_uid INTEGER NOT NULL,
  product VARCHAR(64) NOT NULL,
  document_uid VARCHAR(36) NOT NULL,
  revision INTEGER NOT NULL,
  actor_user_id INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (vpbx_user_uid, product),
  CONSTRAINT fk_ai_license_binding_document FOREIGN KEY (document_uid) REFERENCES ai_local_license_documents(uid)
);
CREATE INDEX idx_ai_license_binding_document ON ai_local_license_bindings (document_uid);
