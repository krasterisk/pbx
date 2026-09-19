CREATE TABLE ai_business_connections (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  name VARCHAR(128) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  draft_revision INTEGER NOT NULL,
  destination VARCHAR(256) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_biz_conn_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT chk_ai_biz_conn_status CHECK (status IN ('draft','ready','revoked','failed'))
);

CREATE TABLE ai_tool_revisions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  connection_id VARCHAR(36) NOT NULL,
  revision INTEGER NOT NULL,
  schema_digest CHAR(64) NOT NULL,
  schema_json TEXT NOT NULL,
  side_effect VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_ai_tool_rev_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_ai_tool_rev_no UNIQUE (connection_id, revision),
  CONSTRAINT chk_ai_tool_side CHECK (side_effect IN ('none','read','mutate')),
  CONSTRAINT fk_ai_tool_rev_conn FOREIGN KEY (vpbx_user_uid, connection_id)
    REFERENCES ai_business_connections (vpbx_user_uid, id)
);

CREATE TABLE ai_robot_tool_bindings (
  vpbx_user_uid INTEGER NOT NULL,
  robot_version_id VARCHAR(36) NOT NULL,
  tool_revision_id VARCHAR(36) NOT NULL,
  timeout_ms INTEGER NOT NULL,
  side_effect_policy VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (robot_version_id, tool_revision_id),
  CONSTRAINT uq_ai_robot_tool_tenant UNIQUE (vpbx_user_uid, robot_version_id, tool_revision_id),
  CONSTRAINT chk_ai_robot_tool_policy CHECK (side_effect_policy IN ('deny_mutate','sandbox','approved')),
  CONSTRAINT fk_ai_robot_tool_rev FOREIGN KEY (vpbx_user_uid, tool_revision_id)
    REFERENCES ai_tool_revisions (vpbx_user_uid, id),
  CONSTRAINT fk_ai_robot_tool_ver FOREIGN KEY (vpbx_user_uid, robot_version_id)
    REFERENCES ai_robot_versions (vpbx_user_uid, id)
);

CREATE TABLE kb_bases (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  draft_revision INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_kb_base_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT chk_kb_base_status CHECK (status IN ('draft','active','archived'))
);

CREATE TABLE kb_documents (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  base_id VARCHAR(36) NOT NULL,
  source_asset_id VARCHAR(36) NOT NULL,
  content_hash CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  tombstoned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_kb_doc_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT chk_kb_doc_status CHECK (status IN ('uploaded','extracted','failed','tombstoned')),
  CONSTRAINT fk_kb_doc_base FOREIGN KEY (vpbx_user_uid, base_id)
    REFERENCES kb_bases (vpbx_user_uid, id)
);

CREATE TABLE kb_document_revisions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  document_id VARCHAR(36) NOT NULL,
  revision INTEGER NOT NULL,
  extract_digest CHAR(64) NOT NULL,
  extract_config TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_kb_doc_rev_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_kb_doc_rev_no UNIQUE (document_id, revision),
  CONSTRAINT fk_kb_doc_rev_doc FOREIGN KEY (vpbx_user_uid, document_id)
    REFERENCES kb_documents (vpbx_user_uid, id)
);

CREATE TABLE kb_chunks (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  document_revision_id VARCHAR(36) NOT NULL,
  ordinal INTEGER NOT NULL,
  text_ref TEXT NOT NULL,
  provenance TEXT NOT NULL,
  tokens INTEGER NOT NULL,
  content_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_kb_chunk_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_kb_chunk_ord UNIQUE (document_revision_id, ordinal),
  CONSTRAINT fk_kb_chunk_rev FOREIGN KEY (vpbx_user_uid, document_revision_id)
    REFERENCES kb_document_revisions (vpbx_user_uid, id)
);

CREATE TABLE kb_embedding_revisions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  chunk_id VARCHAR(36) NOT NULL,
  profile VARCHAR(64) NOT NULL,
  dimension INTEGER NOT NULL,
  vector_ref TEXT NOT NULL,
  state VARCHAR(32) NOT NULL,
  content_hash CHAR(64) NOT NULL,
  CONSTRAINT uq_kb_embed_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT chk_kb_embed_state CHECK (state IN ('pending','ready','failed')),
  CONSTRAINT fk_kb_embed_chunk FOREIGN KEY (vpbx_user_uid, chunk_id)
    REFERENCES kb_chunks (vpbx_user_uid, id)
);

CREATE TABLE kb_releases (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  vpbx_user_uid INTEGER NOT NULL,
  base_id VARCHAR(36) NOT NULL,
  revision INTEGER NOT NULL,
  manifest_digest CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_kb_rel_tenant UNIQUE (vpbx_user_uid, id),
  CONSTRAINT uq_kb_rel_no UNIQUE (base_id, revision),
  CONSTRAINT chk_kb_rel_status CHECK (status IN ('candidate','active','superseded')),
  CONSTRAINT fk_kb_rel_base FOREIGN KEY (vpbx_user_uid, base_id)
    REFERENCES kb_bases (vpbx_user_uid, id)
);

CREATE TABLE kb_release_members (
  vpbx_user_uid INTEGER NOT NULL,
  release_id VARCHAR(36) NOT NULL,
  document_revision_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (release_id, document_revision_id),
  CONSTRAINT uq_kb_member_tenant UNIQUE (vpbx_user_uid, release_id, document_revision_id),
  CONSTRAINT fk_kb_member_rel FOREIGN KEY (vpbx_user_uid, release_id)
    REFERENCES kb_releases (vpbx_user_uid, id),
  CONSTRAINT fk_kb_member_docrev FOREIGN KEY (vpbx_user_uid, document_revision_id)
    REFERENCES kb_document_revisions (vpbx_user_uid, id)
);

CREATE TABLE kb_access_bindings (
  vpbx_user_uid INTEGER NOT NULL,
  base_id VARCHAR(36) NOT NULL,
  principal_kind VARCHAR(16) NOT NULL,
  principal_id VARCHAR(64) NOT NULL,
  permissions VARCHAR(64) NOT NULL,
  revision INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (base_id, principal_kind, principal_id),
  CONSTRAINT uq_kb_access_tenant UNIQUE (vpbx_user_uid, base_id, principal_kind, principal_id),
  CONSTRAINT chk_kb_access_kind CHECK (principal_kind IN ('user','robot')),
  CONSTRAINT fk_kb_access_base FOREIGN KEY (vpbx_user_uid, base_id)
    REFERENCES kb_bases (vpbx_user_uid, id)
);
