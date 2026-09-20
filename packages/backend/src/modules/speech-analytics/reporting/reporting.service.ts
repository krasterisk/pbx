import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { ProductAccessService } from '../../product-access/product-access.service';
import { ProductResourceAuthorization } from '../../integration-credentials/product-resource.authorization';
import type { TenantContext } from '../../integration-credentials/tenant-context';
import type { AnalyticsFilterSpec } from '@krasterisk/shared';
import { DomainError } from '../project-engine';
import { SaProject } from '../speech-analytics.models';
import {
  assertBulkSize, assertSnapshotSize, dashboardRow, filterDigest, newId, neutralizeCsvCell,
  parseCursor, reserveBudget, scheduleSlot, signCursor, validateFilterSpec,
} from './reporting-engine';
import { normalizeRouteMode, resolveCapturePolicy, type AnalyticsRouteMode } from './capture-policy';
import { previewLegacyBackfill } from './backfill-preview';
import { readInternalRelation } from './recording-relations';
import {
  SaBudgetPolicy, SaBulkReanalysisBatch, SaBulkReanalysisItem, SaRecordingRelation,
  SaReportDefinition, SaReportRun, SaReportSchedule, SaReportSnapshotItem, SaTenantCapturePolicy,
} from './reporting.models';

@Injectable()
export class SaReportingService {
  constructor(
    private readonly products: ProductAccessService,
    private readonly resources: ProductResourceAuthorization,
    @InjectModel(SaProject) private readonly projects: typeof SaProject,
    @InjectModel(SaReportDefinition) private readonly definitions: typeof SaReportDefinition,
    @InjectModel(SaReportRun) private readonly runs: typeof SaReportRun,
    @InjectModel(SaReportSnapshotItem) private readonly snapshots: typeof SaReportSnapshotItem,
    @InjectModel(SaReportSchedule) private readonly schedules: typeof SaReportSchedule,
    @InjectModel(SaBudgetPolicy) private readonly budgets: typeof SaBudgetPolicy,
    @InjectModel(SaBulkReanalysisBatch) private readonly batches: typeof SaBulkReanalysisBatch,
    @InjectModel(SaBulkReanalysisItem) private readonly items: typeof SaBulkReanalysisItem,
    @InjectModel(SaTenantCapturePolicy) private readonly policies: typeof SaTenantCapturePolicy,
    @InjectModel(SaRecordingRelation) private readonly relations: typeof SaRecordingRelation,
  ) {}

  private mapError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof DomainError) throw new HttpException({ code: error.code }, error.status);
    throw error;
  }

  private async entitled(tenantUid: number) {
    const access = await this.products.decide(tenantUid, 'speech_analytics');
    return access.allowed === true;
  }

  async dashboard(context: TenantContext, spec: AnalyticsFilterSpec) {
    try {
      const allowed = new Set((await this.projects.findAll({
        where: { tenant_uid: context.tenantUid },
      })).map(row => row.id));
      const filter = validateFilterSpec(spec, allowed);
      await this.resources.authorize(context, {
        product: 'speech_analytics', action: 'analytics:read',
        resourceKind: 'project', resourceId: filter.projectIds[0],
      });
      return dashboardRow({
        eligible: 0, applicable: 0, scored: 0, unknown: 0, notApplicable: 0, unscorable: 0,
        revision: 'none', filterDigest: filterDigest(filter),
      });
    } catch (error) { this.mapError(error); }
  }

  async exportCsv(context: TenantContext, spec: AnalyticsFilterSpec, rows: string[][]) {
    try {
      const allowed = new Set((await this.projects.findAll({
        where: { tenant_uid: context.tenantUid },
      })).map(row => row.id));
      const filter = validateFilterSpec(spec, allowed);
      assertSnapshotSize(rows.length);
      await this.resources.authorize(context, {
        product: 'speech_analytics', action: 'analytics:export',
        resourceKind: 'project', resourceId: filter.projectIds[0],
      });
      return rows.map(row => row.map(neutralizeCsvCell).join(',')).join('\n');
    } catch (error) { this.mapError(error); }
  }

  async createRun(context: TenantContext, body: {
    definitionId: string; slotDate: string; filter: AnalyticsFilterSpec; recordings: string[];
  }) {
    try {
      const definition = await this.definitions.findOne({
        where: { tenant_uid: context.tenantUid, id: body.definitionId },
      });
      if (!definition) throw new NotFoundException({ code: 'resource_not_found' });
      assertSnapshotSize(body.recordings.length);
      const digest = filterDigest(body.filter);
      const slot = scheduleSlot(body.slotDate, definition.draft_revision);
      try {
        const run = await this.runs.create({
          id: newId(), tenant_uid: context.tenantUid, definition_id: definition.id, slot_key: slot,
          filter_digest: digest, filter_spec: JSON.stringify(body.filter), state: 'completed',
          snapshot_hash: digest, created_at: new Date(),
        });
        await this.snapshots.bulkCreate(body.recordings.map(recordingId => ({
          tenant_uid: context.tenantUid, run_id: run.id, recording_id: recordingId,
          review_revision: 0, projected: '{}', created_at: new Date(),
        })));
        return run;
      } catch (error) {
        if (error instanceof UniqueConstraintError) {
          return this.runs.findOne({ where: { definition_id: definition.id, slot_key: slot } });
        }
        throw error;
      }
    } catch (error) { this.mapError(error); }
  }

  async setBudget(context: TenantContext, projectId: string, unitCap: number, pauseOnExceed: boolean) {
    try {
      await this.resources.authorize(context, {
        product: 'speech_analytics', action: 'analytics:configure',
        resourceKind: 'project', resourceId: projectId,
      });
      const existing = await this.budgets.findOne({
        where: { tenant_uid: context.tenantUid, project_id: projectId },
      });
      if (existing) {
        await existing.update({
          unit_cap: unitCap, pause_on_exceed: pauseOnExceed, revision: existing.revision + 1,
          updated_by: Number(context.principalId) || 0, updated_at: new Date(),
        });
        return existing;
      }
      return this.budgets.create({
        tenant_uid: context.tenantUid, project_id: projectId, unit_cap: unitCap, reserved_units: 0,
        pause_on_exceed: pauseOnExceed, revision: 1, updated_by: Number(context.principalId) || 0,
        updated_at: new Date(),
      });
    } catch (error) { this.mapError(error); }
  }

  async reserve(context: TenantContext, projectId: string, units: number) {
    try {
      const policy = await this.budgets.findOne({
        where: { tenant_uid: context.tenantUid, project_id: projectId },
      });
      if (!policy) throw new NotFoundException({ code: 'resource_not_found' });
      const next = reserveBudget(policy.unit_cap, policy.reserved_units, units, policy.pause_on_exceed);
      await policy.update({ reserved_units: next });
      return policy;
    } catch (error) { this.mapError(error); }
  }

  async startBulk(context: TenantContext, projectId: string, recordingIds: string[]) {
    try {
      assertBulkSize(recordingIds.length);
      await this.resources.authorize(context, {
        product: 'speech_analytics', action: 'analytics:configure',
        resourceKind: 'project', resourceId: projectId,
      });
      const batch = await this.batches.create({
        id: newId(), tenant_uid: context.tenantUid, project_id: projectId,
        selection_digest: filterDigest({
          projectIds: [projectId], from: '2020-01-01T00:00:00.000Z', to: '2020-01-02T00:00:00.000Z',
          timezone: 'UTC', runSelector: 'latest_completed', view: 'ai',
        }),
        item_count: recordingIds.length, status: 'pending', created_by: Number(context.principalId) || 0,
        created_at: new Date(), expires_at: new Date(Date.now() + 3600_000),
      });
      await this.items.bulkCreate(recordingIds.map(recordingId => ({
        tenant_uid: context.tenantUid, batch_id: batch.id, recording_id: recordingId,
        status: 'accepted', reason: '',
      })));
      return batch;
    } catch (error) { this.mapError(error); }
  }

  signedCursor(spec: AnalyticsFilterSpec, sortKey: string) {
    return signCursor(process.env.SA_REPORT_CURSOR_SECRET || 'sa-report-cursor-dev', filterDigest(spec), sortKey);
  }

  readCursor(spec: AnalyticsFilterSpec, cursor: string) {
    return parseCursor(process.env.SA_REPORT_CURSOR_SECRET || 'sa-report-cursor-dev', cursor, filterDigest(spec));
  }

  async getPolicy(context: TenantContext) {
    const row = await this.policies.findByPk(context.tenantUid);
    return row ?? {
      tenant_uid: context.tenantUid, default_enabled: false, default_project_id: null,
      pause_new: false, revision: 0, updated_by: 0, updated_at: new Date(0), created_at: new Date(0),
    };
  }

  async setPolicy(context: TenantContext, body: {
    defaultEnabled?: boolean; defaultProjectId?: string | null; pauseNew?: boolean;
  }) {
    try {
      if (!(await this.entitled(context.tenantUid)) && body.defaultEnabled) {
        throw new DomainError('entitlement', 403);
      }
      const existing = await this.policies.findByPk(context.tenantUid);
      const next = {
        default_enabled: body.defaultEnabled ?? existing?.default_enabled ?? false,
        default_project_id: body.defaultProjectId === undefined
          ? existing?.default_project_id ?? null : body.defaultProjectId,
        pause_new: body.pauseNew ?? existing?.pause_new ?? false,
        revision: (existing?.revision ?? 0) + 1,
        updated_by: Number(context.principalId) || 0,
        updated_at: new Date(),
      };
      if (existing) {
        await existing.update(next);
        return existing;
      }
      return this.policies.create({
        tenant_uid: context.tenantUid, ...next, created_at: new Date(),
      });
    } catch (error) { this.mapError(error); }
  }

  async resolveRoute(context: TenantContext, input: {
    mode?: unknown; projectId?: string | null; recordingEnabled: boolean; projectActive?: boolean;
    projectPublished?: boolean;
  }) {
    try {
      const policy = await this.getPolicy(context);
      const mode = normalizeRouteMode(input.mode) as AnalyticsRouteMode;
      const projectId = mode === 'on' ? input.projectId : policy.default_project_id;
      const project = projectId
        ? await this.projects.findOne({ where: { tenant_uid: context.tenantUid, id: projectId } })
        : null;
      return resolveCapturePolicy({
        privacyDenied: false,
        entitled: await this.entitled(context.tenantUid),
        pauseNew: policy.pause_new,
        defaultEnabled: policy.default_enabled,
        defaultProjectId: policy.default_project_id,
        routeMode: mode,
        routeProjectId: input.projectId,
        recordingEnabled: input.recordingEnabled,
        projectActive: input.projectActive ?? project?.status === 'active',
        projectPublished: input.projectPublished ?? Boolean(project?.active_version_id),
        sameTenantProject: !projectId || Boolean(project),
        policyRevision: policy.revision,
      });
    } catch (error) { this.mapError(error); }
  }

  async listRelations(context: TenantContext, recordingId: string) {
    try {
      await this.resources.authorize(context, {
        product: 'speech_analytics', action: 'analytics:read',
        resourceKind: 'recording', resourceId: recordingId,
      });
      const rows = await this.relations.findAll({
        where: { tenant_uid: context.tenantUid, recording_id: recordingId },
      });
      return rows.map(row => {
        const kind = (['cdr', 'callcenter', 'autodial', 'external'].includes(row.source_kind)
          ? row.source_kind : 'external') as 'cdr' | 'callcenter' | 'autodial' | 'external';
        return {
          id: row.id,
          recordingId: row.recording_id,
          sourceKind: kind,
          sourceId: row.source_id,
          linkedid: row.linkedid,
          nodeId: row.node_id,
          ...readInternalRelation({
            sourceKind: kind,
            callPermission: true,
            analyticsPermission: true,
            transcriptPermission: false,
            audioPermission: false,
            snippet: null,
          }),
        };
      });
    } catch (error) { this.mapError(error); }
  }

  previewBackfill(_context: TenantContext, requestedPath?: string) {
    try {
      return previewLegacyBackfill({
        enabled: false,
        tenantInstalled: true,
        requestedPath: requestedPath ?? null,
        files: [],
      });
    } catch (error) { this.mapError(error); }
  }

  async listSchedules(context: TenantContext) {
    return this.schedules.findAll({ where: { tenant_uid: context.tenantUid } });
  }
}
