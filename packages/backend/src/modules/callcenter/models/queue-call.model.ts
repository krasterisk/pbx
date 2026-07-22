import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Full queue-call history row (answered / abandoned / transferred / …).
 * Written by CallCenterHistoryWriterService (batched bulkCreate).
 * Foundation for reports, metrics, wallboard sparklines (Phase 07).
 */
@Table({ tableName: 'cc_queue_calls', timestamps: false })
export class CcQueueCall extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare call_uniqueid: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare queue_name: string;

  @Column({ type: DataType.STRING(64), allowNull: true, defaultValue: '' })
  declare agent_interface: string;

  /** Operator user id when known — enables tenant+agent date indexes. */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare agent_user_uid: number;

  @Column({ type: DataType.STRING(32), allowNull: false, defaultValue: '' })
  declare caller_id_num: string;

  @Column({ type: DataType.STRING(128), allowNull: true, defaultValue: '' })
  declare caller_id_name: string;

  @Column({ type: DataType.DATE, allowNull: true })
  declare enter_time: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare answer_time: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare end_time: Date;

  /** Seconds waiting in queue before answer/abandon. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare wait_time: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare talk_time: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare hold_time: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare wrapup_time: number;

  @Column({
    type: DataType.ENUM('answered', 'abandoned', 'transferred', 'timeout', 'other'),
    allowNull: false,
    defaultValue: 'other',
  })
  declare disposition: 'answered' | 'abandoned' | 'transferred' | 'timeout' | 'other';

  /** Queue position at enter/abandon (1-based, 0 if unknown). */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare position: number;

  /**
   * D-34/D-35: call direction so this table can carry non-queue rows too
   * (personal/outbound/internal), not only queue calls.
   */
  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'inbound' })
  declare direction: 'inbound' | 'outbound' | 'personal' | 'internal';

  /** D-34/D-35: free-form call type/channel classification for history filtering. */
  @Column({ type: DataType.STRING(32), allowNull: true, defaultValue: '' })
  declare call_type: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
