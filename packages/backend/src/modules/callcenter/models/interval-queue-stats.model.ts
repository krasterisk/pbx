import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * 15-minute queue aggregate (cc-analytics C1). Additive sums, same meaning as `cc_daily_queue_stats`
 * v2, so any union of intervals gives the same totals as the day rollup.
 *
 * `interval_start` is a UTC quarter hour. Every real timezone offset is a multiple of 15 minutes,
 * so the bucket is also a local quarter hour for any tenant; coarser buckets (30 / 60 min) are
 * folded at read time in the tenant timezone. A call belongs to the bucket of its write time
 * (`cc_queue_calls.created_at`, i.e. its end), exactly like the daily rollup.
 */
@Table({ tableName: 'cc_interval_queue_stats', timestamps: false })
export class CcIntervalQueueStats extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.DATE, allowNull: false })
  declare interval_start: Date;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare queue_name: string;

  /** Offered (incl. short abandons). */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_calls: number;

  /** Handled = answered + transferred. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare answered_calls: number;

  /** Abandoned beyond the short-abandon window. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare abandoned_calls: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare short_abandoned_calls: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare transferred_calls: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare sla_met_calls: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 20 })
  declare sla_threshold_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_wait_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_talk_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_hold_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_wrapup_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare max_wait_sec: number;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updated_at: Date;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
