import { AllowNull, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'ai_business_connections', timestamps: false })
export class AiBusinessConnection extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(128)) declare name: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare kind: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare draft_revision: number;
  @AllowNull(false) @Column(DataType.STRING(256)) declare destination: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_tool_revisions', timestamps: false })
export class AiToolRevision extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare connection_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare schema_digest: string;
  @AllowNull(false) @Column(DataType.TEXT) declare schema_json: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare side_effect: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'ai_robot_tool_bindings', timestamps: false })
export class AiRobotToolBinding extends Model {
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare robot_version_id: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare tool_revision_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare timeout_ms: number;
  @AllowNull(false) @Column(DataType.STRING(32)) declare side_effect_policy: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}
