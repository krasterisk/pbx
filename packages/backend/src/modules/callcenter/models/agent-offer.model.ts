import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * One queue offer to one agent that did not become a conversation (Ring-No-Answer).
 *
 * This is an agent-level attempt, NOT a caller-level call: the same `call_uniqueid`
 * can be offered to several agents and still be answered later, so it never lives in
 * `cc_queue_calls` (queue aggregates, SLA, abandon). RNA rate and the operator
 * "missed" KPI are derived from this table.
 */
@Table({ tableName: 'cc_agent_offers', timestamps: false })
export class CcAgentOffer extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare call_uniqueid: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare queue_name: string;

  @Column({ type: DataType.STRING(64), allowNull: false, defaultValue: '' })
  declare agent_interface: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare agent_user_uid: number | null;

  @Column({ type: DataType.STRING(32), allowNull: false, defaultValue: '' })
  declare caller_id_num: string;

  /** Offer outcome. Only `rna` (ring no answer) is written today. */
  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'rna' })
  declare outcome: string;

  /** Seconds the agent phone rang before the attempt ended. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare ring_time: number;

  @Column({ type: DataType.DATE, allowNull: false })
  declare offered_at: Date;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
