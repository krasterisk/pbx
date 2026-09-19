import { AllowNull, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'kb_bases', timestamps: false })
export class KbBase extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(128)) declare name: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare draft_revision: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare created_by: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'kb_documents', timestamps: false })
export class KbDocument extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare base_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare source_asset_id: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare content_hash: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @Column(DataType.DATE) declare tombstoned_at: Date | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'kb_document_revisions', timestamps: false })
export class KbDocumentRevision extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare document_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare extract_digest: string;
  @AllowNull(false) @Column(DataType.TEXT) declare extract_config: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'kb_chunks', timestamps: false })
export class KbChunk extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare document_revision_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare ordinal: number;
  @AllowNull(false) @Column(DataType.TEXT) declare text_ref: string;
  @AllowNull(false) @Column(DataType.TEXT) declare provenance: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare tokens: number;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare content_hash: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'kb_embedding_revisions', timestamps: false })
export class KbEmbeddingRevision extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare chunk_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare profile: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare dimension: number;
  @AllowNull(false) @Column(DataType.TEXT) declare vector_ref: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare content_hash: string;
}

@Table({ tableName: 'kb_releases', timestamps: false })
export class KbRelease extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare base_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare manifest_digest: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare created_by: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'kb_release_members', timestamps: false })
export class KbReleaseMember extends Model {
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare release_id: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare document_revision_id: string;
}

@Table({ tableName: 'kb_access_bindings', timestamps: false })
export class KbAccessBinding extends Model {
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare base_id: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(16)) declare principal_kind: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(64)) declare principal_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare permissions: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}
