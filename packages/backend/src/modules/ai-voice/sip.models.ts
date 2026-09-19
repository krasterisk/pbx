import { AllowNull, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'ai_sip_connections', timestamps: false })
export class AiSipConnection extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(128)) declare name: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.STRING(16)) declare transport: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare auth_kind: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare draft_revision: number;
  @AllowNull(false) @Column(DataType.BOOLEAN) declare secret_once_shown: boolean;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_sip_config_revisions', timestamps: false })
export class AiSipConfigRevision extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare connection_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare config_digest: string;
  @AllowNull(false) @Column(DataType.TEXT) declare config: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'ai_sip_did_bindings', timestamps: false })
export class AiSipDidBinding extends Model {
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare connection_id: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(64)) declare did: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare deployment_id: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'ai_voice_invocations', timestamps: false })
export class AiVoiceInvocation extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare deployment_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare principal: string;
  @AllowNull(false) @Column(DataType.STRING(128)) declare external_call_id: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare request_hash: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @Column(DataType.STRING(36)) declare session_id: string | null;
  @AllowNull(false) @Column(DataType.STRING(128)) declare destination_ref: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}
