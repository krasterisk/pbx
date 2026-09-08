import { Column, DataType, Model, Table } from 'sequelize-typescript';

export const AGENT_WORKFLOW_STATUSES = [
  'pending',
  'applying',
  'applied',
  'failed',
  'rejected',
  'denied',
  'expired',
] as const;
export type AgentWorkflowStatus = (typeof AGENT_WORKFLOW_STATUSES)[number];

export const AGENT_WORKFLOW_STEP_STATUSES = [
  'pending',
  'applying',
  'applied',
  'failed',
  'skipped',
] as const;
export type AgentWorkflowStepStatus = (typeof AGENT_WORKFLOW_STEP_STATUSES)[number];

/**
 * Multi-step staged HITL plan. A single mutation is represented as a one-step
 * workflow; the legacy proposal API remains a compatibility view over that.
 */
@Table({ tableName: 'ai_agent_workflows', timestamps: false, freezeTableName: true })
export class AgentWorkflow extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.CHAR(36), allowNull: false, unique: true })
  declare workflow_id: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare thread_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare vpbx_user_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare brief_version: number;

  @Column({ type: DataType.STRING(255), allowNull: false, defaultValue: '' })
  declare title: string;

  @Column({ type: DataType.JSON, allowNull: false, defaultValue: [] })
  declare summary: string[];

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'pending' })
  declare status: AgentWorkflowStatus;

  @Column({ type: DataType.TEXT, allowNull: true, defaultValue: null })
  declare error: string | null;

  @Column({ type: DataType.DATE, allowNull: false })
  declare expires_at: Date;

  @Column({ type: DataType.DATE, allowNull: true, defaultValue: null })
  declare applied_at: Date | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updated_at: Date;
}

@Table({ tableName: 'ai_agent_workflow_steps', timestamps: false, freezeTableName: true })
export class AgentWorkflowStep extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare workflow_uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare step_key: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare step_index: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare tool: string;

  @Column({ type: DataType.STRING(64), allowNull: false, defaultValue: '' })
  declare entity_type: string;

  @Column({ type: DataType.STRING(255), allowNull: false, defaultValue: '' })
  declare entity_label: string;

  @Column({ type: DataType.JSON, allowNull: false, defaultValue: [] })
  declare depends_on: string[];

  @Column({ type: DataType.JSON, allowNull: false })
  declare canonical_args: Record<string, unknown>;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare schema_version: string;

  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare before_json: Record<string, unknown> | null;

  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare after_json: Record<string, unknown> | null;

  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare result_json: Record<string, unknown> | null;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'pending' })
  declare status: AgentWorkflowStepStatus;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare attempts: number;

  @Column({ type: DataType.TEXT, allowNull: true, defaultValue: null })
  declare error: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare requires_secure_input: boolean;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updated_at: Date;
}
