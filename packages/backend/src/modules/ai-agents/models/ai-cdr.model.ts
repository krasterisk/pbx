import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Call Detail Record for AI sessions — source of truth for billing.
 * One row per AI-handled call, populated by `BillingService.recordUsage`
 * at session end.
 */
@Table({ tableName: 'cc_ai_cdr', timestamps: false })
export class CcAiCdr extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare call_uniqueid: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare agent_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare provider_uid: number;

  @Column({ type: DataType.STRING(64), allowNull: true, defaultValue: '' })
  declare queue: string;

  @Column({ type: DataType.ENUM('realtime', 'cascade'), allowNull: false })
  declare pipeline_mode: 'realtime' | 'cascade';

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare started_at: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare ended_at: Date;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare duration_sec: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare tokens_in: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare tokens_out: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare audio_seconds: number;

  /** Audit trail of MCP-style tool calls in this session. */
  @Column({ type: DataType.JSON, allowNull: true })
  declare tool_calls: any[];

  @Column({ type: DataType.DECIMAL(10, 4), allowNull: false, defaultValue: 0 })
  declare cost_input: number;

  @Column({ type: DataType.DECIMAL(10, 4), allowNull: false, defaultValue: 0 })
  declare cost_output: number;

  @Column({ type: DataType.DECIMAL(10, 4), allowNull: false, defaultValue: 0 })
  declare cost_audio: number;

  @Column({ type: DataType.DECIMAL(10, 4), allowNull: false, defaultValue: 0 })
  declare cost_total: number;

  @Column({ type: DataType.STRING(8), allowNull: false, defaultValue: 'USD' })
  declare currency: string;

  @Column({ type: DataType.STRING(255), allowNull: true, defaultValue: '' })
  declare recording_ref: string;

  @Column({ type: DataType.STRING(255), allowNull: true, defaultValue: '' })
  declare transcript_ref: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
