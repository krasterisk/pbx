import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Per-tenant singleton: where/how to route threshold alerts (D-28).
 * Thresholds (WHEN) live in cc_settings.alert_thresholds (D-27);
 * this table holds routing (WHERE/channel) via notification_integration.
 */
@Table({ tableName: 'cc_alert_config', timestamps: false })
export class CcAlertConfig extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  /** FK to notification_integrations.uid (Telegram/email channel). */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare integration_uid: number | null;

  /** Recipient (chat_id / email). */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare target: string | null;

  /** Whether alerts are enabled for this tenant. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare enabled: boolean;

  /** Min seconds between repeated alerts of the same type (anti-flood). */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 300 })
  declare cooldown_sec: number;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updated_at: Date;

  // Tenant isolation — singleton per tenant
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
