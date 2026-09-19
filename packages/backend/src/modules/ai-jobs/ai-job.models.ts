import {
  AllowNull, Column, DataType, Model, PrimaryKey, Table,
} from 'sequelize-typescript';

@Table({ tableName: 'ai_idempotency', timestamps: false })
export class AiIdempotency extends Model {
  @PrimaryKey @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare stable_principal_id: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(64)) declare operation_namespace: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.BLOB) declare key_digest: Buffer;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare request_hash: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @Column(DataType.STRING(36)) declare resource_id: string | null;
  @Column(DataType.INTEGER) declare response_status: number | null;
  @AllowNull(false) @Column(DataType.TEXT) declare safe_response: string;
  @AllowNull(false) @Column(DataType.DATE) declare expires_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_jobs', timestamps: false })
export class AiJob extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(64)) declare product: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare kind: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare resource_kind: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare resource_id: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @Column(DataType.STRING(36)) declare policy_revision_id: string | null;
  @Column(DataType.STRING(36)) declare config_revision_id: string | null;
  @Column(DataType.STRING(36)) declare provider_revision_id: string | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare priority: number;
  @Column(DataType.DATE) declare cancel_requested_at: Date | null;
  @AllowNull(false) @Column(DataType.DATE) declare admitted_at: Date;
  @Column(DataType.DATE) declare terminal_at: Date | null;
  @Column(DataType.DATE) declare next_run_at: Date | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare version: number;
  @Column(DataType.STRING(36)) declare idempotency_principal_id: string | null;
  @Column(DataType.STRING(64)) declare idempotency_namespace: string | null;
  @Column(DataType.BLOB) declare idempotency_key_digest: Buffer | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_job_stages', timestamps: false })
export class AiJobStage extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare job_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare stage_key: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare attempt_count: number;
  @Column(DataType.DATE) declare next_run_at: Date | null;
  @Column(DataType.STRING(64)) declare lease_owner: string | null;
  @Column(DataType.DATE) declare lease_until: Date | null;
  @AllowNull(false) @Column(DataType.BIGINT) declare fence: string;
  @Column(DataType.TEXT) declare output_ref: string | null;
  @Column(DataType.STRING(64)) declare error_code: string | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare version: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_provider_operations', timestamps: false })
export class AiProviderOperation extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare stage_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare ordinal: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare provider_revision_id: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare idempotency_token: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare request_hash: string;
  @Column(DataType.STRING(128)) declare provider_request_id: string | null;
  @Column(DataType.TEXT) declare response_ref: string | null;
  @Column(DataType.TEXT) declare usage_ref: string | null;
  @Column(DataType.DATE) declare started_at: Date | null;
  @Column(DataType.DATE) declare completed_at: Date | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare version: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_outbox', timestamps: false })
export class AiOutbox extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(32)) declare aggregate_kind: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare aggregate_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare aggregate_version: number;
  @AllowNull(false) @Column(DataType.STRING(64)) declare event_type: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare schema_version: number;
  @AllowNull(false) @Column(DataType.TEXT) declare payload: string;
  @AllowNull(false) @Column(DataType.DATE) declare available_at: Date;
  @Column(DataType.DATE) declare lease_until: Date | null;
  @Column(DataType.STRING(64)) declare lease_owner: string | null;
  @AllowNull(false) @Column(DataType.BIGINT) declare fence: string;
  @Column(DataType.DATE) declare delivered_at: Date | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare attempts: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare version: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'ai_job_events', timestamps: false })
export class AiJobEvent extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare job_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare event_type: string;
  @Column(DataType.STRING(32)) declare from_state: string | null;
  @Column(DataType.STRING(32)) declare to_state: string | null;
  @AllowNull(false) @Column(DataType.STRING(64)) declare actor: string;
  @Column(DataType.STRING(128)) declare reason: string | null;
  @AllowNull(false) @Column(DataType.DATE) declare occurred_at: Date;
}
