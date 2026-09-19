import { AllowNull, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'sa_metric_definitions', timestamps: false })
export class SaMetricDefinition extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare project_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare metric_key: string;
  @Column(DataType.DATE) declare archived_at: Date | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'sa_metric_revisions', timestamps: false })
export class SaMetricRevision extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare definition_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare schema_digest: string;
  @AllowNull(false) @Column(DataType.TEXT) declare rubric: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'sa_project_version_metrics', timestamps: false })
export class SaProjectVersionMetric extends Model {
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare project_version_id: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare definition_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare metric_revision_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare sort_order: number;
  @AllowNull(false) @Column(DataType.DECIMAL(8, 4)) declare weight: string;
}

@Table({ tableName: 'sa_metric_values', timestamps: false })
export class SaMetricValue extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare run_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare metric_revision_id: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @Column(DataType.BOOLEAN) declare bool_value: boolean | null;
  @Column(DataType.DECIMAL(18, 6)) declare number_value: string | null;
  @Column(DataType.STRING(64)) declare enum_value: string | null;
  @Column(DataType.TEXT) declare string_value: string | null;
  @Column(DataType.DECIMAL(8, 4)) declare normalised_score: string | null;
  @AllowNull(false) @Column(DataType.TEXT) declare evidence_refs: string;
  @Column(DataType.STRING(64)) declare error_code: string | null;
}

@Table({ tableName: 'sa_human_reviews', timestamps: false })
export class SaHumanReview extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare run_id: string;
  @AllowNull(false) @Column(DataType.STRING(36)) declare metric_revision_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare expected_review_revision: number;
  @AllowNull(false) @Column(DataType.TEXT) declare value: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.TEXT) declare reason: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare actor_user_id: number;
  @Column(DataType.STRING(36)) declare supersedes_id: string | null;
  @AllowNull(false) @Column(DataType.STRING(64)) declare command_key: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'sa_transcript_corrections', timestamps: false })
export class SaTranscriptCorrection extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare transcript_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.TEXT) declare text: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare author_user_id: number;
  @AllowNull(false) @Column(DataType.TEXT) declare reason: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}
