import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Tool-call audit trail. One row per MCP tool invocation by an AI agent
 * (also mirrored to `cc_ai_cdr.tool_calls` JSON for the in-session view).
 */
@Table({ tableName: 'cc_ai_audit_log', timestamps: false })
export class CcAiAuditLog extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare call_uniqueid: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare agent_uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare tool_name: string;

  @Column({ type: DataType.JSON, allowNull: true })
  declare args: any;

  @Column({ type: DataType.JSON, allowNull: true })
  declare result: any;

  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare duration_ms: number;

  @Column({
    type: DataType.ENUM('ok', 'error', 'rate_limited', 'denied'),
    allowNull: false,
    defaultValue: 'ok',
  })
  declare status: 'ok' | 'error' | 'rate_limited' | 'denied';

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
