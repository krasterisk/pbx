import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Scheduled call-center report delivery (D-35).
 * Cron tick finds enabled rows with next_run_at <= now and delivers via notification_integration.
 */
@Table({ tableName: 'cc_report_schedules', timestamps: false })
export class CcReportSchedule extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  /** One of CcReportId whitelist values — validated in service, not DB ENUM. */
  @Column({ type: DataType.STRING(32), allowNull: false })
  declare report_id: string;

  @Column({
    type: DataType.ENUM('csv', 'xlsx'),
    allowNull: false,
    defaultValue: 'xlsx',
  })
  declare format: 'csv' | 'xlsx';

  @Column({
    type: DataType.ENUM('today', 'yesterday', 'last-7-days', 'last-30-days', 'previous-month'),
    allowNull: false,
    defaultValue: 'yesterday',
  })
  declare period_preset: 'today' | 'yesterday' | 'last-7-days' | 'last-30-days' | 'previous-month';

  /** Optional filters: { queueName?, agentInterface? } */
  @Column({ type: DataType.JSON, allowNull: true })
  declare filters: { queueName?: string; agentInterface?: string } | null;

  @Column({
    type: DataType.ENUM('daily', 'weekly', 'monthly'),
    allowNull: false,
    defaultValue: 'daily',
  })
  declare frequency: 'daily' | 'weekly' | 'monthly';

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 8 })
  declare hour: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare minute: number;

  /** 0-6 (Sun-Sat) for weekly frequency. */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare day_of_week: number | null;

  /** 1-28 for monthly frequency (cap 28 so day exists in every month). */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare day_of_month: number | null;

  /** FK-like reference to notification_integrations.uid */
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare integration_uid: number;

  /** Override recipient (email address or chat target). */
  @Column({ type: DataType.STRING(256), allowNull: true })
  declare target: string | null;

  @Column({ type: DataType.STRING(256), allowNull: true })
  declare subject_template: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare message_template: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare enabled: boolean;

  @Column({ type: DataType.DATE, allowNull: true })
  declare last_run_at: Date | null;

  @Column({ type: DataType.STRING(16), allowNull: true })
  declare last_status: string | null;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare last_error: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare next_run_at: Date | null;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
