import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { ConversationBrief } from '../conversation-brief.types';

export type AgentThreadStatus = 'active' | 'archived';

/**
 * Persistent chat-agent conversation (D-26).
 * Scoped by tenant (`vpbx_user_uid`) and author (`user_uid`) on every query.
 * Token counters on this row are the D-08 spend accumulator.
 * `brief_json` is the source-evidenced pinned brief used for bounded replay.
 */
@Table({ tableName: 'ai_agent_threads', timestamps: false, freezeTableName: true })
export class AgentThread extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare vpbx_user_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;

  @Column({ type: DataType.STRING(255), allowNull: false, defaultValue: '' })
  declare title: string;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'active' })
  declare status: AgentThreadStatus;

  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: null })
  declare provider_uid: number | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare tokens_in: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare tokens_out: number;

  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare brief_json: ConversationBrief | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare brief_version: number;

  @Column({ type: DataType.BIGINT, allowNull: true, defaultValue: null })
  declare brief_updated_through_message_uid: number | null;

  @Column({ type: DataType.DATE, allowNull: true, defaultValue: null })
  declare last_message_at: Date | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updated_at: Date;
}
