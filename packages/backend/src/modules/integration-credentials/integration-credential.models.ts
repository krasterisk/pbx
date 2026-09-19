import {
  AllowNull, Column, DataType, Model, PrimaryKey, Table,
} from 'sequelize-typescript';

@Table({ tableName: 'ai_integration_principals', timestamps: false })
export class IntegrationPrincipal extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(120)) declare label: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare product: string;
  @AllowNull(false) @Column(DataType.STRING(16)) declare status: 'active' | 'disabled';
  @AllowNull(false) @Column(DataType.BIGINT) declare permission_revision: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare created_by: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_integration_credentials', timestamps: false })
export class IntegrationCredential extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare principal_id: string;
  @AllowNull(false) @Column(DataType.STRING(22)) declare selector: string;
  @AllowNull(false) @Column(DataType.BLOB) declare secret_digest: Buffer;
  @Column(DataType.STRING(36)) declare predecessor_id: string | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare generation: number;
  @Column(DataType.DATE) declare expires_at: Date | null;
  @Column(DataType.DATE) declare revoked_at: Date | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.INTEGER) declare created_by: number;
}

@Table({ tableName: 'ai_integration_grants', timestamps: false })
export class IntegrationGrant extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare principal_id: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare resource_kind: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare resource_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare scope: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'ai_integration_audit', timestamps: false })
export class IntegrationAudit extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare principal_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare actor_user_id: number;
  @AllowNull(false) @Column(DataType.STRING(32)) declare action: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare request_id: string;
  @AllowNull(false) @Column(DataType.TEXT) declare metadata: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'ai_integration_commands', timestamps: false })
export class IntegrationCommand extends Model {
  @PrimaryKey @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.INTEGER) declare actor_user_id: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare operation_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare command_hash: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare principal_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare resulting_generation: number;
  @AllowNull(false) @Column(DataType.DATE) declare completed_at: Date;
}

@Table({ tableName: 'ai_integration_auth_limits', timestamps: false })
export class IntegrationAuthLimit extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(64)) declare key_hash: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare attempts: number;
  @AllowNull(false) @Column(DataType.DATE) declare expires_at: Date;
}
