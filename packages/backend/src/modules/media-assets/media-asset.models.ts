import {
  AllowNull, Column, DataType, Model, PrimaryKey, Table,
} from 'sequelize-typescript';

@Table({ tableName: 'ai_media_assets', timestamps: false })
export class AiMediaAsset extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(32)) declare source_kind: string;
  @AllowNull(false) @Column(DataType.STRING(255)) declare storage_key: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @Column(DataType.CHAR(64)) declare sha256: string | null;
  @AllowNull(false) @Column(DataType.BIGINT) declare bytes: string;
  @Column(DataType.BIGINT) declare duration_ms: string | null;
  @AllowNull(false) @Column(DataType.TEXT) declare media_metadata: string;
  @Column(DataType.DATE) declare retention_at: Date | null;
  @Column(DataType.STRING(36)) declare parent_asset_id: string | null;
  @Column(DataType.DATE) declare deleted_at: Date | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare version: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_uploads', timestamps: false })
export class AiUpload extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare principal_id: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare resource_kind: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare resource_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare asset_id: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @Column(DataType.BIGINT) declare expected_bytes: string | null;
  @Column(DataType.CHAR(64)) declare expected_checksum: string | null;
  @AllowNull(false) @Column(DataType.BIGINT) declare received_bytes: string;
  @AllowNull(false) @Column(DataType.DATE) declare expires_at: Date;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare request_hash: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare version: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}
