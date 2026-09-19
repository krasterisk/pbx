import { AllowNull, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'ai_robot_drafts', timestamps: false })
export class AiRobotDraft extends Model {
  @PrimaryKey @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.INTEGER) declare agent_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare robot_uuid: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare draft_revision: number;
  @AllowNull(false) @Column(DataType.TEXT) declare runtime_policy: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_robot_versions', timestamps: false })
export class AiRobotVersion extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare agent_uid: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare version_no: number;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare config_digest: string;
  @AllowNull(false) @Column(DataType.TEXT) declare config: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare llm_revision_id: string;
  @Column(DataType.STRING(36)) declare stt_revision_id: string | null;
  @Column(DataType.STRING(36)) declare tts_revision_id: string | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare created_by: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'ai_robot_deployments', timestamps: false })
export class AiRobotDeployment extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare agent_uid: number;
  @AllowNull(false) @Column(DataType.STRING(32)) declare kind: string;
  @Column(DataType.STRING(36)) declare active_version_id: string | null;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.TEXT) declare capture_policy: string;
  @AllowNull(false) @Column(DataType.TEXT) declare fallback_policy: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'ai_voice_sessions', timestamps: false })
export class AiVoiceSession extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare deployment_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare version_id: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare ingress_kind: string;
  @AllowNull(false) @Column(DataType.STRING(128)) declare ingress_key: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare node_id: string;
  @Column(DataType.STRING(128)) declare channel_uniqueid: string | null;
  @AllowNull(false) @Column(DataType.STRING(64)) declare owner: string;
  @AllowNull(false) @Column(DataType.BIGINT) declare fence: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @Column(DataType.STRING(64)) declare reason: string | null;
  @Column(DataType.STRING(36)) declare capture_intent_id: string | null;
  @Column(DataType.STRING(36)) declare usage_reservation_id: string | null;
  @AllowNull(false) @Column(DataType.DATE) declare started_at: Date;
  @Column(DataType.DATE) declare ended_at: Date | null;
}

@Table({ tableName: 'ai_voice_turns', timestamps: false })
export class AiVoiceTurn extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare session_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare input_turn_id: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare output_epoch: number;
  @AllowNull(false) @Column(DataType.STRING(16)) declare role: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @AllowNull(false) @Column(DataType.TEXT) declare text: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare provenance: string;
  @AllowNull(false) @Column(DataType.BIGINT) declare started_ms: string;
  @Column(DataType.BIGINT) declare ended_ms: string | null;
  @Column(DataType.BIGINT) declare played_until_ms: string | null;
}

@Table({ tableName: 'ai_voice_events', timestamps: false })
export class AiVoiceEvent extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare session_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare sequence: number;
  @AllowNull(false) @Column(DataType.STRING(64)) declare type: string;
  @AllowNull(false) @Column(DataType.TEXT) declare payload: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'ai_call_control_operations', timestamps: false })
export class AiCallControlOperation extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare session_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare operation_key: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare action: string;
  @Column(DataType.STRING(128)) declare target_ref: string | null;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @Column(DataType.STRING(32)) declare observed_result: string | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'ai_voice_tickets', timestamps: false })
export class AiVoiceTicket extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(64)) declare node_id: string;
  @AllowNull(false) @Column(DataType.STRING(128)) declare channel_uniqueid: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare deployment_id: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare digest: string;
  @AllowNull(false) @Column(DataType.DATE) declare expires_at: Date;
  @Column(DataType.DATE) declare consumed_at: Date | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}
