import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'cc_agent_sessions', timestamps: false })
export class CcAgentSession extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_id: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare agent_interface: string;

  @Column({ type: DataType.DATE, allowNull: true, defaultValue: DataType.NOW })
  declare login_time: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare logout_time: Date;

  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare total_calls: number;

  /** Total talk time in seconds */
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare total_talk_time: number;

  /** Total pause time in seconds */
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare total_pause_time: number;

  /** Total idle (ready but not on call) time in seconds */
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare total_idle_time: number;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
