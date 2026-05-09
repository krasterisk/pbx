import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'cc_agent_events', timestamps: false })
export class CcAgentEvent extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare session_id: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_id: number;

  @Column({
    type: DataType.ENUM(
      'LOGIN', 'LOGOUT', 'READY', 'PAUSE',
      'CALL_START', 'CALL_END',
      'WRAPUP_START', 'WRAPUP_END',
      'HOLD', 'UNHOLD',
    ),
    allowNull: false,
  })
  declare event_type: string;

  /** Pause reason, hangup cause, etc. */
  @Column({ type: DataType.STRING(128), allowNull: true, defaultValue: '' })
  declare reason: string;

  @Column({ type: DataType.STRING(64), allowNull: true, defaultValue: '' })
  declare call_uniqueid: string;

  @Column({ type: DataType.STRING(32), allowNull: true, defaultValue: '' })
  declare caller_id: string;

  @Column({ type: DataType.STRING(64), allowNull: true, defaultValue: '' })
  declare queue_name: string;

  /** Duration in seconds (filled when the state ends) */
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare duration: number;

  @Column({ type: DataType.DATE, allowNull: true, defaultValue: DataType.NOW })
  declare created_at: Date;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
