import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { AgentItemVisibility, AgentTurnCloseKind } from '@krasterisk/shared';

export type AgentThreadMessageRole = 'user' | 'assistant' | 'tool' | 'system';

/**
 * One message in a persisted chat-agent conversation (D-26).
 * `vpbx_user_uid` is denormalized so every query filters by tenant without a join.
 */
@Table({ tableName: 'ai_agent_thread_messages', timestamps: false, freezeTableName: true })
export class AgentThreadMessage extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare thread_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare vpbx_user_uid: number;

  @Column({ type: DataType.STRING(16), allowNull: false })
  declare role: AgentThreadMessageRole;

  @Column({ type: DataType.TEXT, allowNull: true, defaultValue: null })
  declare content: string | null;

  @Column({ type: DataType.STRING(128), allowNull: true, defaultValue: null })
  declare tool_name: string | null;

  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare tool_calls: unknown;

  @Column({ type: DataType.CHAR(36), allowNull: true, defaultValue: null })
  declare proposal_id: string | null;

  /** Provider tool_call_id so assistant/tool pairs replay correctly. */
  @Column({ type: DataType.STRING(128), allowNull: true, defaultValue: null })
  declare tool_call_id: string | null;

  @Column({ type: DataType.STRING(128), allowNull: true, defaultValue: null })
  declare provider_model: string | null;

  /** Чем ассистент закрыл ход. NULL у user/tool-строк и у internal-шагов. */
  @Column({ type: DataType.STRING(16), allowNull: true, defaultValue: null })
  declare close_kind: AgentTurnCloseKind | null;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'public' })
  declare visibility: AgentItemVisibility;

  /** Внутренние размышления модели. Никогда не покидают сервер. */
  @Column({ type: DataType.TEXT, allowNull: true, defaultValue: null })
  declare reasoning: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare tokens_in: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare tokens_out: number;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;
}
