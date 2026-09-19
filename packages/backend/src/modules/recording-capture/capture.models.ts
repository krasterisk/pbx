import { AllowNull, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'ai_capture_node_bindings', timestamps: false })
export class AiCaptureNodeBinding extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare node_id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare identity_digest: string;
  @AllowNull(false) @Column(DataType.DATE) declare expires_at: Date;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare config_digest: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'ai_capture_intents', timestamps: false })
export class AiCaptureIntent extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(64)) declare node_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare recording_uid: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare origin_kind: string;
  @AllowNull(false) @Column(DataType.STRING(128)) declare origin_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare recorder_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare binding_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare binding_revision: number;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @AllowNull(false) @Column(DataType.TEXT) declare policy_snapshot: string;
  @Column(DataType.STRING(128)) declare call_ref: string | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @Column(DataType.DATE) declare closed_at: Date | null;
}

@Table({ tableName: 'ai_capture_segments', timestamps: false })
export class AiCaptureSegment extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare intent_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare ordinal: number;
  @AllowNull(false) @Column(DataType.STRING(64)) declare leg_ref: string;
  @AllowNull(false) @Column(DataType.BIGINT) declare start_ms: string;
  @Column(DataType.BIGINT) declare end_ms: string | null;
  @AllowNull(false) @Column(DataType.TEXT) declare track_map: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare privacy_decision: string;
}

@Table({ tableName: 'ai_capture_receipts', timestamps: false })
export class AiCaptureReceipt extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(64)) declare node_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare recording_uid: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare manifest_revision: number;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare digest: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare asset_id: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.DATE) declare acked_at: Date;
}
