import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Per-tenant call-center settings singleton (D-07 default SLA + D-27 alert thresholds).
 * Unique on vpbx_user_uid.
 */
@Table({ tableName: 'cc_settings', timestamps: false })
export class CcSettings extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  /** D-07: tenant default SLA threshold (sec) when queue has no servicelevel. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 20 })
  declare default_sla_threshold: number;

  /**
   * D-27: flexible alert thresholds JSON.
   * Known keys: max_wait_sec, abandon_rate_pct, sla_critical_pct, agents_available_min.
   */
  @Column({ type: DataType.JSON, allowNull: true })
  declare alert_thresholds: Record<string, number> | null;

  /** D-27: play alert sound on wallboard. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare alert_sound_enabled: boolean;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updated_at: Date;

  // Tenant isolation — singleton per tenant
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
