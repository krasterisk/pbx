CREATE TABLE ai_business_connections (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  name VARCHAR(128) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  draft_revision INT NOT NULL,
  destination VARCHAR(256) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_biz_conn_tenant (vpbx_user_uid, id),
  CONSTRAINT chk_ai_biz_conn_status CHECK (status IN ('draft','ready','revoked','failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_tool_revisions (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  connection_id VARCHAR(36) NOT NULL,
  revision INT NOT NULL,
  schema_digest CHAR(64) NOT NULL,
  schema_json TEXT NOT NULL,
  side_effect VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_tool_rev_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_ai_tool_rev_no (connection_id, revision),
  CONSTRAINT chk_ai_tool_side CHECK (side_effect IN ('none','read','mutate')),
  CONSTRAINT fk_ai_tool_rev_conn FOREIGN KEY (vpbx_user_uid, connection_id)
    REFERENCES ai_business_connections (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_robot_tool_bindings (
  vpbx_user_uid INT NOT NULL,
  robot_version_id VARCHAR(36) NOT NULL,
  tool_revision_id VARCHAR(36) NOT NULL,
  timeout_ms INT NOT NULL,
  side_effect_policy VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (robot_version_id, tool_revision_id),
  UNIQUE KEY uq_ai_robot_tool_tenant (vpbx_user_uid, robot_version_id, tool_revision_id),
  CONSTRAINT chk_ai_robot_tool_policy CHECK (side_effect_policy IN ('deny_mutate','sandbox','approved')),
  CONSTRAINT fk_ai_robot_tool_rev FOREIGN KEY (vpbx_user_uid, tool_revision_id)
    REFERENCES ai_tool_revisions (vpbx_user_uid, id),
  CONSTRAINT fk_ai_robot_tool_ver FOREIGN KEY (vpbx_user_uid, robot_version_id)
    REFERENCES ai_robot_versions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE kb_bases (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  draft_revision INT NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kb_base_tenant (vpbx_user_uid, id),
  CONSTRAINT chk_kb_base_status CHECK (status IN ('draft','active','archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE kb_documents (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  base_id VARCHAR(36) NOT NULL,
  source_asset_id VARCHAR(36) NOT NULL,
  content_hash CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  tombstoned_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kb_doc_tenant (vpbx_user_uid, id),
  CONSTRAINT chk_kb_doc_status CHECK (status IN ('uploaded','extracted','failed','tombstoned')),
  CONSTRAINT fk_kb_doc_base FOREIGN KEY (vpbx_user_uid, base_id)
    REFERENCES kb_bases (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE kb_document_revisions (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  document_id VARCHAR(36) NOT NULL,
  revision INT NOT NULL,
  extract_digest CHAR(64) NOT NULL,
  extract_config TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kb_doc_rev_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_kb_doc_rev_no (document_id, revision),
  CONSTRAINT fk_kb_doc_rev_doc FOREIGN KEY (vpbx_user_uid, document_id)
    REFERENCES kb_documents (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE kb_chunks (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  document_revision_id VARCHAR(36) NOT NULL,
  ordinal INT NOT NULL,
  text_ref TEXT NOT NULL,
  provenance TEXT NOT NULL,
  tokens INT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kb_chunk_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_kb_chunk_ord (document_revision_id, ordinal),
  CONSTRAINT fk_kb_chunk_rev FOREIGN KEY (vpbx_user_uid, document_revision_id)
    REFERENCES kb_document_revisions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE kb_embedding_revisions (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  chunk_id VARCHAR(36) NOT NULL,
  profile VARCHAR(64) NOT NULL,
  dimension INT NOT NULL,
  vector_ref TEXT NOT NULL,
  state VARCHAR(32) NOT NULL,
  content_hash CHAR(64) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kb_embed_tenant (vpbx_user_uid, id),
  CONSTRAINT chk_kb_embed_state CHECK (state IN ('pending','ready','failed')),
  CONSTRAINT fk_kb_embed_chunk FOREIGN KEY (vpbx_user_uid, chunk_id)
    REFERENCES kb_chunks (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE kb_releases (
  id VARCHAR(36) NOT NULL,
  vpbx_user_uid INT NOT NULL,
  base_id VARCHAR(36) NOT NULL,
  revision INT NOT NULL,
  manifest_digest CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kb_rel_tenant (vpbx_user_uid, id),
  UNIQUE KEY uq_kb_rel_no (base_id, revision),
  CONSTRAINT chk_kb_rel_status CHECK (status IN ('candidate','active','superseded')),
  CONSTRAINT fk_kb_rel_base FOREIGN KEY (vpbx_user_uid, base_id)
    REFERENCES kb_bases (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE kb_release_members (
  vpbx_user_uid INT NOT NULL,
  release_id VARCHAR(36) NOT NULL,
  document_revision_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (release_id, document_revision_id),
  UNIQUE KEY uq_kb_member_tenant (vpbx_user_uid, release_id, document_revision_id),
  CONSTRAINT fk_kb_member_rel FOREIGN KEY (vpbx_user_uid, release_id)
    REFERENCES kb_releases (vpbx_user_uid, id),
  CONSTRAINT fk_kb_member_docrev FOREIGN KEY (vpbx_user_uid, document_revision_id)
    REFERENCES kb_document_revisions (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE kb_access_bindings (
  vpbx_user_uid INT NOT NULL,
  base_id VARCHAR(36) NOT NULL,
  principal_kind VARCHAR(16) NOT NULL,
  principal_id VARCHAR(64) NOT NULL,
  permissions VARCHAR(64) NOT NULL,
  revision INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (base_id, principal_kind, principal_id),
  UNIQUE KEY uq_kb_access_tenant (vpbx_user_uid, base_id, principal_kind, principal_id),
  CONSTRAINT chk_kb_access_kind CHECK (principal_kind IN ('user','robot')),
  CONSTRAINT fk_kb_access_base FOREIGN KEY (vpbx_user_uid, base_id)
    REFERENCES kb_bases (vpbx_user_uid, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
