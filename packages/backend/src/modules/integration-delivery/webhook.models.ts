import { AllowNull, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'ai_webhook_endpoints', timestamps: false })
export class AiWebhookEndpoint extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare principal_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare project_id: string;
  @AllowNull(false) @Column(DataType.STRING(512)) declare destination_url: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare secret_ref: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare key_version: number;
  @Column(DataType.STRING(64)) declare previous_secret_ref: string | null;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_webhook_deliveries', timestamps: false })
export class AiWebhookDelivery extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare event_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare endpoint_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare endpoint_revision: number;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare payload_digest: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare attempt: number;
  @Column(DataType.DATE) declare next_at: Date | null;
  @Column(DataType.STRING(16)) declare http_class: string | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_webhook_attempts', timestamps: false })
export class AiWebhookAttempt extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare delivery_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare ordinal: number;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @Column(DataType.INTEGER) declare latency_ms: number | null;
  @Column(DataType.STRING(64)) declare error_code: string | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}
