import { AllowNull, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'sa_report_definitions', timestamps: false })
export class SaReportDefinition extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare project_id: string;
  @AllowNull(false) @Column(DataType.STRING(128)) declare name: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare owner_user_id: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare draft_revision: number;
  @AllowNull(false) @Column(DataType.TEXT) declare filter_spec: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare template: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare timezone: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'sa_report_runs', timestamps: false })
export class SaReportRun extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare definition_id: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare slot_key: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare filter_digest: string;
  @AllowNull(false) @Column(DataType.TEXT) declare filter_spec: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare state: string;
  @Column(DataType.STRING(36)) declare job_id: string | null;
  @Column(DataType.TEXT) declare artifact_ref: string | null;
  @Column(DataType.CHAR(64)) declare snapshot_hash: string | null;
  @Column(DataType.DATE) declare expires_at: Date | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'sa_report_snapshot_items', timestamps: false })
export class SaReportSnapshotItem extends Model {
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare run_id: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare recording_id: string;
  @Column(DataType.STRING(36)) declare result_id: string | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare review_revision: number;
  @AllowNull(false) @Column(DataType.TEXT) declare projected: string;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'sa_report_schedules', timestamps: false })
export class SaReportSchedule extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare definition_id: string;
  @AllowNull(false) @Column(DataType.STRING(16)) declare cadence: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare timezone: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare next_slot: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.TEXT) declare recipients: string;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'sa_budget_policies', timestamps: false })
export class SaBudgetPolicy extends Model {
  @PrimaryKey @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare project_id: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare unit_cap: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare reserved_units: number;
  @AllowNull(false) @Column(DataType.BOOLEAN) declare pause_on_exceed: boolean;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare updated_by: number;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
}

@Table({ tableName: 'sa_bulk_reanalysis_batches', timestamps: false })
export class SaBulkReanalysisBatch extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare project_id: string;
  @AllowNull(false) @Column(DataType.CHAR(64)) declare selection_digest: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare item_count: number;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare created_by: number;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare expires_at: Date;
}

@Table({ tableName: 'sa_bulk_reanalysis_items', timestamps: false })
export class SaBulkReanalysisItem extends Model {
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare batch_id: string;
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare recording_id: string;
  @Column(DataType.STRING(36)) declare job_id: string | null;
  @AllowNull(false) @Column(DataType.STRING(32)) declare status: string;
  @AllowNull(false) @Column(DataType.TEXT) declare reason: string;
}

@Table({ tableName: 'sa_tenant_capture_policies', timestamps: false })
export class SaTenantCapturePolicy extends Model {
  @PrimaryKey @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.BOOLEAN) declare default_enabled: boolean;
  @Column(DataType.STRING(36)) declare default_project_id: string | null;
  @AllowNull(false) @Column(DataType.BOOLEAN) declare pause_new: boolean;
  @AllowNull(false) @Column(DataType.INTEGER) declare revision: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare updated_by: number;
  @AllowNull(false) @Column(DataType.DATE) declare updated_at: Date;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}

@Table({ tableName: 'sa_recording_relations', timestamps: false })
export class SaRecordingRelation extends Model {
  @PrimaryKey @AllowNull(false) @Column(DataType.STRING(36)) declare id: string;
  @AllowNull(false) @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' }) declare tenant_uid: number;
  @AllowNull(false) @Column(DataType.STRING(36)) declare recording_id: string;
  @AllowNull(false) @Column(DataType.STRING(32)) declare source_kind: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare source_id: string;
  @Column(DataType.STRING(64)) declare linkedid: string | null;
  @Column(DataType.STRING(64)) declare node_id: string | null;
  @AllowNull(false) @Column(DataType.DATE) declare created_at: Date;
}
