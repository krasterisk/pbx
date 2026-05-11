import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Missed call (abandoned in queue).
 * Created on `QueueCallerAbandon` AMI event, retained for callback workflow.
 */
@Table({ tableName: 'cc_missed_calls', timestamps: false })
export class CcMissedCall extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare call_uniqueid: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare queue_name: string;

  @Column({ type: DataType.STRING(32), allowNull: false, defaultValue: '' })
  declare caller_id_num: string;

  @Column({ type: DataType.STRING(128), allowNull: true, defaultValue: '' })
  declare caller_id_name: string;

  /** Seconds the caller waited before abandoning. */
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare hold_time: number;

  /** Queue position when the caller dropped (1-based, 0 if unknown). */
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare position: number;

  /** Set when an operator marks this caller as called-back. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare called_back: boolean;

  /** User id of the operator who called back (NULL until handled). */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare called_back_by: number;

  @Column({ type: DataType.DATE, allowNull: true })
  declare called_back_at: Date;

  @Column({ type: DataType.STRING(255), allowNull: true, defaultValue: '' })
  declare note: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
