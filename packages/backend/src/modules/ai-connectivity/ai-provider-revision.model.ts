import {
  AllowNull, Column, DataType, Model, PrimaryKey, Table,
} from 'sequelize-typescript';

@Table({ tableName: 'ai_provider_revisions', timestamps: false })
export class AiProviderRevision extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(64)) declare provider_uid: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.TEXT) declare configuration: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare capability_digest: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare credential_ref: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare key_version: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}
