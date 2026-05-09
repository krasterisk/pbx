import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Persistent agent-to-queue assignment (configuration).
 * Used to remember which queues an agent should join on login.
 * Also stores penalty (priority) for each queue assignment.
 */
@Table({ tableName: 'cc_agent_queues', timestamps: false })
export class CcAgentQueue extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_id: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare agent_interface: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare queue_name: string;

  /** Queue penalty — lower value = higher priority */
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare penalty: number;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;
}
