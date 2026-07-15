import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Daily rollup of agent handling stats (Phase 07 D-08).
 * Filled by CallCenterRollupService nightly cron / recomputeDay.
 */
@Table({ tableName: 'cc_daily_agent_stats', timestamps: false })
export class CcDailyAgentStats extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare stat_date: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare agent_interface: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare agent_user_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare calls_handled: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_talk_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_hold_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare total_wrapup_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare avg_handle_sec: number;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
