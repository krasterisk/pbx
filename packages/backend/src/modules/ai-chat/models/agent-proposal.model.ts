import { randomUUID } from 'crypto';
import { Column, DataType, Model, Table } from 'sequelize-typescript';

export const AGENT_PROPOSAL_STATUSES = ['pending', 'applied', 'rejected', 'denied', 'expired'] as const;
export type AgentProposalStatus = (typeof AGENT_PROPOSAL_STATUSES)[number];

/**
 * Pending change proposal for the confirmation card (D-18 / 15-05).
 *
 * `apply_payload` is server-side only — never serialized to the model or the browser (T-15-07).
 * Status vocabulary matches the UI-contract card badges one for one.
 */
@Table({ tableName: 'ai_agent_proposals', timestamps: false, freezeTableName: true })
export class AgentProposal extends Model {
  static override get tableName(): string {
    return 'ai_agent_proposals';
  }

  /** Platform crypto UUID — not the outdated `uuid` package. */
  @Column({ primaryKey: true, type: DataType.CHAR(36), defaultValue: () => randomUUID() })
  declare proposal_id: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare thread_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare vpbx_user_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare entity_type: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare entity_label: string;

  /** Human-readable bullet list rendered on the confirmation card. */
  @Column({ type: DataType.JSON, allowNull: false })
  declare summary: string[];

  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare before_json: Record<string, unknown> | null;

  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare after_json: Record<string, unknown> | null;

  /**
   * Server-side apply payload. Never serialized to the model or the browser.
   * 15-05 owns the serialization test that keeps it out of responses.
   */
  @Column({ type: DataType.JSON, allowNull: false })
  declare apply_payload: Record<string, unknown>;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare includes_dialplan_reload: boolean;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'pending' })
  declare status: AgentProposalStatus;

  @Column({ type: DataType.TEXT, allowNull: true, defaultValue: null })
  declare error: string | null;

  /** Set twenty-four hours ahead when the row is created. */
  @Column({ type: DataType.DATE, allowNull: false })
  declare expires_at: Date;

  @Column({ type: DataType.DATE, allowNull: true, defaultValue: null })
  declare applied_at: Date | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;
}
