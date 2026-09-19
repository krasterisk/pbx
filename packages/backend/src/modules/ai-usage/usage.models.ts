import {
  AllowNull, Column, DataType, Model, PrimaryKey, Table,
} from 'sequelize-typescript';

@Table({ tableName: 'ai_quota_counters', timestamps: false })
export class AiQuotaCounter extends Model {
  @PrimaryKey @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(64)) declare product: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(64)) declare metric: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.DATE) declare period_start: Date;
  @AllowNull(false) @Column(DataType.BIGINT) declare limit_units: string;
  @AllowNull(false) @Column(DataType.BIGINT) declare used_units: string;
  @AllowNull(false) @Column(DataType.BIGINT) declare reserved_units: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_price_revisions', timestamps: false })
export class AiPriceRevision extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare provider_uid: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare product: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare unit: string;
  @Column(DataType.STRING(8)) declare currency: string | null;
  @Column(DataType.DECIMAL(20, 10)) declare rate: string | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare scale: number;
  @AllowNull(false) @Column(DataType.STRING(16)) declare rounding_mode: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare money_policy: string;
  @AllowNull(false) @Column(DataType.DATE) declare effective_at: Date;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare config_digest: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'ai_usage_reservations', timestamps: false })
export class AiUsageReservation extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare job_id: string;
  @Column(DataType.STRING(36)) declare provider_operation_id: string | null;
  @Column(DataType.STRING(36)) declare parent_reservation_id: string | null;
  @AllowNull(false) @Column(DataType.STRING(80)) declare owner_key: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare metric: string;
  @AllowNull(false) @Column(DataType.DATE) declare period_start: Date;
  @AllowNull(false) @Column(DataType.BIGINT) declare held_units: string;
  @AllowNull(false) @Column(DataType.BIGINT) declare settled_units: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @AllowNull(false) @Column(DataType.DATE) declare expires_at: Date;
  @Column(DataType.DATE) declare heartbeat_at: Date | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare version: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_usage_events', timestamps: false })
export class AiUsageEvent extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare provider_operation_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare event_key: string;
  @AllowNull(false) @Column(DataType.BIGINT) declare quantity: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare unit: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare source: string;
  @Column(DataType.STRING(36)) declare price_revision_id: string | null;
  @AllowNull(false) @Column(DataType.DATE) declare occurred_at: Date;
}

@Table({ tableName: 'ai_usage_ledger', timestamps: false })
export class AiUsageLedger extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare reservation_id: string;
  @AllowNull(false) @Column(DataType.STRING(80)) declare operation_id: string;
  @AllowNull(false) @Column(DataType.STRING(16)) declare entry_kind: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare sequence: number;
  @AllowNull(false) @Column(DataType.BIGINT) declare units: string;
  @Column(DataType.DECIMAL(20, 10)) declare amount_decimal: string | null;
  @Column(DataType.STRING(8)) declare currency: string | null;
  @Column(DataType.STRING(36)) declare price_revision_id: string | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}
