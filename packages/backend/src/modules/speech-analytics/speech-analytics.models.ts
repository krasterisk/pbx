import { AllowNull, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'sa_projects', timestamps: false })
export class SaProject extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(128)) declare name: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare draft_revision: number;
  @AllowNull(false) @Column(DataType.TEXT) declare draft_config: string;
  @Column(DataType.STRING(36)) declare active_version_id: string | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare created_by: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'sa_project_versions', timestamps: false })
export class SaProjectVersion extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare project_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare version_no: number;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare config_digest: string;
  @AllowNull(false) @Column(DataType.TEXT) declare config: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare stt_revision_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare llm_revision_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare created_by: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'sa_project_members', timestamps: false })
export class SaProjectMember extends Model {
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare project_id: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.INTEGER) declare user_id: number;
  @AllowNull(false) @Column(DataType.STRING(32)) declare role: string;
  @AllowNull(false) @Column(DataType.BOOLEAN) declare can_audio: boolean;
  @AllowNull(false) @Column(DataType.BOOLEAN) declare can_transcript: boolean;
}

@Table({ tableName: 'sa_recordings', timestamps: false })
export class SaRecording extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare project_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare integration_principal_id: string;
  @AllowNull(false) @Column(DataType.STRING(128)) declare external_call_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare source_part: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare business_key_hash: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare asset_id: string;
  @AllowNull(false) @Column(DataType.TEXT) declare metadata: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare content_digest: string;
  @AllowNull(false) @Column(DataType.DATE) declare occurred_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'sa_analysis_runs', timestamps: false })
export class SaAnalysisRun extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare recording_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare project_version_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare job_id: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @Column(DataType.STRING(36)) declare transcript_id: string | null;
  @Column(DataType.STRING(36)) declare result_id: string | null;
  @Column(DataType.STRING(36)) declare parent_run_id: string | null;
  @Column(DataType.STRING(64)) declare reason: string | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'sa_transcripts', timestamps: false })
export class SaTranscript extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare asset_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare stt_revision_id: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare content_digest: string;
  @AllowNull(false) @Column(DataType.TEXT) declare coverage: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'sa_transcript_segments', timestamps: false })
export class SaTranscriptSegment extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare transcript_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare ordinal: number;
  @AllowNull(false) @Column(DataType.BIGINT) declare start_ms: string;
  @AllowNull(false) @Column(DataType.BIGINT) declare end_ms: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare channel: number;
  @AllowNull(false) @Column(DataType.STRING(32)) declare speaker_role: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare role_source: string;
  @AllowNull(false) @Column(DataType.TEXT) declare text: string;
  @Column(DataType.DECIMAL(6, 5)) declare confidence: string | null;
}

@Table({ tableName: 'sa_results', timestamps: false })
export class SaResult extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare run_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare version: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare schema_version: number;
  @AllowNull(false) @Column(DataType.TEXT) declare summary: string;
  @AllowNull(false) @Column(DataType.TEXT) declare metric_results: string;
  @AllowNull(false) @Column(DataType.TEXT) declare evidence_refs: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare quality: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}
