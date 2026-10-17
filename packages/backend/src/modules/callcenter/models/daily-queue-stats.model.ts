import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Daily rollup of queue call stats (Phase 07 D-08).
 * Filled by CallCenterRollupService nightly cron / recomputeDay.
 */
@Table({ tableName: 'cc_daily_queue_stats', timestamps: false })
export class CcDailyQueueStats extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare stat_date: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare queue_name: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_calls: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare answered_calls: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare abandoned_calls: number;

  /**
   * Numerator for SLA%: answered calls within the per-queue servicelevel threshold.
   * Denominator is answered_calls; actual SLA% is computed by metrics/reports (07-03/07-12).
   */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare sla_met_calls: number;

  /** Average speed of answer (ASA) in seconds. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare avg_wait_sec: number;

  /** Average talk time (AHT talk component) in seconds. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare avg_talk_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare avg_hold_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare max_wait_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_talk_sec: number;

  /**
   * Version 2 (cc-analytics): `answered_calls` = handled (answered + transferred), `abandoned_calls`
   * excludes short abandons, and additive sums are stored. Version 1 rows predate the metrics dictionary.
   */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare transferred_calls: number;

  /** Abandons within the tenant short-abandon window; excluded from the offered denominator. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare short_abandoned_calls: number;

  /** Per-queue SLA threshold (sec) that `sla_met_calls` was computed with. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 20 })
  declare sla_threshold_sec: number;

  /** Σ wait of handled calls (ASA numerator). */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_wait_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_hold_sec: number;

  /** Σ wrapup of handled calls (AHT numerator together with total_talk_sec). */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_wrapup_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
  declare rollup_version: number;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
