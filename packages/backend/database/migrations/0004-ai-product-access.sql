CREATE TABLE ai_product_activation (
  vpbx_user_uid INT NOT NULL,
  product VARCHAR(64) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 1,
  actor_user_id INT NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (vpbx_user_uid, product)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_local_license_documents (
  uid VARCHAR(36) NOT NULL,
  license_id VARCHAR(36) NOT NULL,
  revision INT NOT NULL,
  vpbx_user_uid INT NOT NULL,
  installation_id VARCHAR(128) NOT NULL,
  payload_bytes LONGBLOB NOT NULL,
  signature_bytes BLOB NOT NULL,
  digest_sha256 VARCHAR(64) NOT NULL,
  imported_at DATETIME(3) NOT NULL,
  imported_by INT NOT NULL,
  max_observed_at DATETIME(3) NOT NULL,
  PRIMARY KEY (uid),
  UNIQUE KEY uq_ai_license_revision (license_id, revision),
  KEY idx_ai_license_tenant (vpbx_user_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_local_license_bindings (
  vpbx_user_uid INT NOT NULL,
  product VARCHAR(64) NOT NULL,
  document_uid VARCHAR(36) NOT NULL,
  revision INT NOT NULL,
  actor_user_id INT NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (vpbx_user_uid, product),
  KEY idx_ai_license_binding_document (document_uid),
  CONSTRAINT fk_ai_license_binding_document FOREIGN KEY (document_uid) REFERENCES ai_local_license_documents(uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
