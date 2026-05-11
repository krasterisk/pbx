import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * A named bundle of tool bindings an AI agent is allowed to call
 * (MCP-style). Each `ToolBinding` describes name + JSON-schema + handler ref
 * (local function name OR remote MCP endpoint).
 */
@Table({ tableName: 'cc_ai_toolsets', timestamps: false })
export class CcAiToolset extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string;

  /** Array<ToolBinding> — see AI plan §7 for shape. */
  @Column({ type: DataType.JSON, allowNull: false })
  declare tools: any[];

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
