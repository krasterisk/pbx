import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { CallbackSource, CallbackStatus } from '@krasterisk/shared';

@Table({ tableName: 'cc_callback_requests', timestamps: false, freezeTableName: true })
export class CallbackRequest extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false, defaultValue: '' })
  declare caller: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare route_uid: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare queue_uid: number | null;

  /** Queue name for operator membership filter (queue_table has no numeric PK). */
  @Column({ type: DataType.STRING(64), allowNull: true })
  declare queue_name: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare step_id: string | null;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare uniqueid: string | null;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'pending' })
  declare status: CallbackStatus;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare attempt_count: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 3 })
  declare max_attempts: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 30 })
  declare pause_minutes: number;

  @Column({ type: DataType.DATE, allowNull: true })
  declare next_attempt_at: Date | null;

  @Column({ type: DataType.STRING(5), allowNull: false, defaultValue: '09:00' })
  declare window_start: string;

  @Column({ type: DataType.STRING(5), allowNull: false, defaultValue: '21:00' })
  declare window_end: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare claimed_agent_uid: number | null;

  @Column({ type: DataType.STRING(24), allowNull: false, defaultValue: 'route_step' })
  declare source: CallbackSource;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updated_at: Date;
}
