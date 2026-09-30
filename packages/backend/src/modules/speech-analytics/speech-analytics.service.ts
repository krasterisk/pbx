import {
  ConflictException, ForbiddenException, HttpException, Inject, Injectable, Logger,
  NotFoundException, Optional, PayloadTooLargeException, UnprocessableEntityException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { Sequelize } from 'sequelize-typescript';
import { UniqueConstraintError } from 'sequelize';
import {
  defaultSaProjectConfig, saEventWebhookTargets, type SaProjectConfigV1,
} from '@krasterisk/shared';
import { AiJobAdmissionService } from '../ai-jobs/ai-job-admission.service';
import { SpeechProviderResolver } from './speech-provider.resolver';
import { AiMediaAsset, AiUpload } from '../media-assets/media-asset.models';
import { ProductAccessService } from '../product-access/product-access.service';
import { ProductResourceAuthorization } from '../integration-credentials/product-resource.authorization';
import {
  IntegrationCredential, IntegrationGrant, IntegrationPrincipal,
} from '../integration-credentials/integration-credential.models';
import type { TenantContext } from '../integration-credentials/tenant-context';
import { User, UserLevel } from '../users/user.model';
import { Route } from '../routes/route.model';
import { NotificationIntegration } from '../notifications/notification-integration.model';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { WebhookQueueService } from '../routes/webhook-queue.service';
import { configDigest, DomainError } from './project-engine';
import { claimRecording, emptyIngestStores, metadataAllowlist, uploadChecksum } from './ingest-engine';
import { SA_ANALYSIS_WORKER } from './hangup-analytics.port';
import { releaseFinishedSpeechJobs } from './release-speech-jobs';
import type { SaAnalysisWorker } from './jobs/sa-analysis.worker';
import { runPipeline } from './pipeline';
import {
  SaAnalysisRun, SaProject, SaProjectMember, SaProjectVersion, SaRecording, SaResult, SaTranscript,
  SaTranscriptSegment,
} from './speech-analytics.models';
import {
  ProjectEditorError,
  assertValidTemplate,
  canDeleteProject,
  canPublishProject,
  metricSetStampPayload,
  stampChanged,
} from './projects/project-editor.service';
import {
  evaluateBudgetSoftLimit,
  sumSaChargeRunAmounts,
} from './projects/budget';
import {
  assertIntegrationsForTenant,
  axiosSaHttpPoster,
  clearRouteAnalyticsProject,
  enqueueSaEventWebhook,
  planDeleteProjectEffects,
  testSaEventWebhook,
} from './projects/event-webhooks';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class SpeechAnalyticsService {
  private readonly logger = new Logger(SpeechAnalyticsService.name);
  constructor(
    private readonly sequelize: Sequelize,
    private readonly admission: AiJobAdmissionService,
    private readonly products: ProductAccessService,
    private readonly resources: ProductResourceAuthorization,
    private readonly webhooks: WebhookQueueService,
    @InjectModel(SaProject) private readonly projects: typeof SaProject,
    @InjectModel(SaProjectVersion) private readonly versions: typeof SaProjectVersion,
    @InjectModel(SaProjectMember) private readonly members: typeof SaProjectMember,
    @InjectModel(SaRecording) private readonly recordings: typeof SaRecording,
    @InjectModel(SaAnalysisRun) private readonly runs: typeof SaAnalysisRun,
    @InjectModel(SaTranscript) private readonly transcripts: typeof SaTranscript,
    @InjectModel(SaTranscriptSegment) private readonly segments: typeof SaTranscriptSegment,
    @InjectModel(SaResult) private readonly results: typeof SaResult,
    @InjectModel(AiMediaAsset) private readonly assets: typeof AiMediaAsset,
    @InjectModel(AiUpload) private readonly uploads: typeof AiUpload,
    @InjectModel(IntegrationGrant) private readonly grants: typeof IntegrationGrant,
    @InjectModel(IntegrationCredential) private readonly credentials: typeof IntegrationCredential,
    @InjectModel(IntegrationPrincipal) private readonly principals: typeof IntegrationPrincipal,
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Route) private readonly routes: typeof Route,
    @InjectModel(NotificationIntegration) private readonly integrations: typeof NotificationIntegration,
    private readonly notifications: NotificationDispatcherService,
    @Optional() @Inject(SA_ANALYSIS_WORKER) private readonly worker: SaAnalysisWorker | null = null,
    @Optional() private readonly speechProviders?: SpeechProviderResolver,
  ) {}

  /** In-process byte store for putUploadContent (closes skeleton gap; D-14). */
  private readonly uploadBodies = new Map<string, Buffer>();
  private readonly uploadQueue = new Map<number, Promise<void>>();

  private userId(context: TenantContext): number {
    const match = /^user:(\d+)$/.exec(context.principalId);
    return match ? Number(match[1]) : 0;
  }

  private async resolveUserLevel(context: TenantContext): Promise<number> {
    const userId = this.userId(context);
    if (!userId) throw new ForbiddenException({ code: 'resource_permission_denied' });
    const user = await this.users.findOne({
      where: { uniqueid: userId },
      attributes: ['uniqueid', 'level'],
    });
    if (!user) throw new ForbiddenException({ code: 'resource_permission_denied' });
    return Number(user.getDataValue('level'));
  }

  /** D-38 partial: tenant right defaults off until 18-15; do not clear existing overrides. */
  private applyModelOverridePolicy(
    existing: SaProjectConfigV1,
    incoming: SaProjectConfigV1,
    allowOverride: boolean,
  ): SaProjectConfigV1 {
    if (allowOverride) return incoming;
    return {
      ...incoming,
      sttModelId: existing.sttModelId ?? null,
      scoreModelId: existing.scoreModelId ?? null,
    };
  }

  private parseConfig(raw: string): SaProjectConfigV1 {
    try {
      return { ...defaultSaProjectConfig(), ...(JSON.parse(raw) as SaProjectConfigV1) };
    } catch {
      return defaultSaProjectConfig();
    }
  }

  private async assertDigestIntegrations(tenantUid: number, config: SaProjectConfigV1): Promise<void> {
    const uids = [
      ...config.digest.integrationUids,
      ...config.alerts.integrationUids,
    ];
    if (!uids.length) return;
    const rows = await this.integrations.findAll({
      where: { uid: { [Op.in]: [...new Set(uids)] } },
      attributes: ['uid', 'user_uid'],
    });
    assertIntegrationsForTenant(
      tenantUid,
      uids,
      rows.map((row) => ({ uid: row.uid, tenantUid: row.user_uid })),
    );
  }

  async assertScope(context: TenantContext, projectId: string, scope: string): Promise<SaProject> {
    await this.resources.authorize(context, {
      product: 'speech_analytics', action: scope, resourceKind: 'project', resourceId: projectId,
    });
    const project = await this.projects.findOne({ where: { tenant_uid: context.tenantUid, id: projectId } });
    if (!project) throw new NotFoundException({ code: 'resource_not_found' });
    if (context.principalKind === 'integration') {
      const grant = await this.grants.findOne({
        where: {
          tenant_uid: context.tenantUid, principal_id: context.principalId,
          resource_id: projectId, scope,
        },
      });
      if (!grant) throw new ForbiddenException({ code: 'resource_permission_denied' });
    }
    return project;
  }

  async createProject(context: TenantContext, name: string): Promise<SaProject> {
    if (context.principalKind !== 'user') throw new ForbiddenException({ code: 'tenant_admin_required' });
    const access = await this.products.decide(context.tenantUid, 'speech_analytics');
    if (!access.allowed) throw new ForbiddenException({ code: access.reason ?? 'not_entitled' });
    const now = new Date();
    return this.sequelize.transaction(async (transaction) => {
      const project = await this.projects.create({
        id: randomUUID(), tenant_uid: context.tenantUid, name, status: 'draft',
        draft_revision: 1, draft_config: JSON.stringify(defaultSaProjectConfig()),
        active_version_id: null, created_by: this.userId(context), created_at: now, updated_at: now,
      }, { transaction });
      await this.members.create({
        tenant_uid: context.tenantUid, project_id: project.id, user_id: this.userId(context),
        role: 'owner', can_audio: true, can_transcript: true,
      }, { transaction });
      return project;
    });
  }

  async listProjects(context: TenantContext): Promise<SaProject[]> {
    const tenantUid = Number(context.tenantUid);
    if (!Number.isInteger(tenantUid) || tenantUid < 0) {
      throw new ForbiddenException({ code: 'tenant_inactive' });
    }
    const rows = await this.projects.findAll({
      where: { tenant_uid: tenantUid },
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    const counts = await this.recordings.findAll({
      attributes: [
        'project_id',
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'recordingCount'],
      ],
      where: { tenant_uid: tenantUid },
      group: ['project_id'],
      raw: true,
    }) as unknown as Array<{ project_id: string; recordingCount: string | number }>;
    const countByProject = new Map(counts.map((row) => [row.project_id, Number(row.recordingCount) || 0]));
    const activeIds = rows.map((row) => row.active_version_id).filter((id): id is string => Boolean(id));
    const versions = activeIds.length === 0
      ? []
      : await this.versions.findAll({
        where: { tenant_uid: tenantUid, id: { [Op.in]: activeIds } },
        attributes: ['id', 'version_no', 'config'],
      });
    const versionById = new Map(versions.map((version) => [version.id, version]));
    return rows.map((row) => {
      const published = row.active_version_id ? versionById.get(row.active_version_id) : undefined;
      const draftDigest = configDigest(this.parseConfig(row.draft_config));
      const publishedDigest = published ? configDigest(this.parseConfig(published.config)) : null;
      return {
        ...row.toJSON(),
        recordingCount: countByProject.get(row.id) ?? 0,
        analysisVersionNo: published?.version_no ?? null,
        unpublished: !published || draftDigest !== publishedDigest,
      };
    }) as unknown as SaProject[];
  }

  async listVersions(context: TenantContext, projectId: string) {
    const project = await this.assertScope(context, projectId, 'analytics:read');
    const rows = await this.versions.findAll({
      where: { tenant_uid: context.tenantUid, project_id: projectId },
      order: [['version_no', 'DESC']],
    });
    return rows.map((row) => ({
      id: row.id,
      versionNo: row.version_no,
      createdAt: row.created_at,
      current: row.id === project.active_version_id,
      metricStamp: JSON.stringify(metricSetStampPayload(this.parseConfig(row.config))),
    }));
  }

  /** Point analysis at an older published snapshot and copy it into the draft. */
  async restoreVersion(context: TenantContext, projectId: string, versionId: string): Promise<SaProject> {
    if (context.principalKind === 'integration') throw new ForbiddenException({ code: 'resource_permission_denied' });
    const level = await this.resolveUserLevel(context);
    if (!canPublishProject(level)) throw new ForbiddenException({ code: 'resource_permission_denied' });
    return this.sequelize.transaction(async (transaction) => {
      const project = await this.projects.findOne({
        where: { tenant_uid: context.tenantUid, id: projectId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!project) throw new NotFoundException({ code: 'resource_not_found' });
      const version = await this.versions.findOne({
        where: { tenant_uid: context.tenantUid, project_id: projectId, id: versionId },
        transaction,
      });
      if (!version) throw new NotFoundException({ code: 'resource_not_found' });
      project.active_version_id = version.id;
      project.draft_config = version.config;
      project.draft_revision += 1;
      project.status = 'active';
      project.updated_at = new Date();
      await project.save({ transaction });
      return project;
    });
  }

  async updateDraft(context: TenantContext, projectId: string, expectedRevision: number, config: SaProjectConfigV1): Promise<SaProject> {
    const project = await this.assertScope(context, projectId, 'analytics:read');
    if (context.principalKind === 'integration') throw new ForbiddenException({ code: 'resource_permission_denied' });
    if (project.draft_revision !== expectedRevision) throw new ConflictException({ code: 'stale_draft' });
    try {
      assertValidTemplate(config);
      await this.assertDigestIntegrations(context.tenantUid, config);
    } catch (error) {
      this.mapEditorError(error);
    }
    const existing = this.parseConfig(project.draft_config);
    const level = await this.resolveUserLevel(context);
    const allowOverride = level === UserLevel.SUPERADMIN;
    const next = this.applyModelOverridePolicy(existing, config, allowOverride);
    project.draft_config = JSON.stringify(next);
    project.draft_revision += 1;
    project.updated_at = new Date();
    await project.save();
    return project;
  }

  async setIntake(context: TenantContext, projectId: string, enabled: boolean): Promise<SaProject> {
    const project = await this.assertScope(context, projectId, 'analytics:read');
    if (context.principalKind === 'integration') throw new ForbiddenException({ code: 'resource_permission_denied' });
    project.status = enabled ? (project.active_version_id ? 'active' : 'draft') : 'archived';
    project.updated_at = new Date();
    await project.save();
    return project;
  }

  async publish(context: TenantContext, projectId: string, _operationKey: string): Promise<SaProjectVersion> {
    if (context.principalKind === 'integration') throw new ForbiddenException({ code: 'resource_permission_denied' });
    const access = await this.products.decide(context.tenantUid, 'speech_analytics');
    if (!access.allowed) throw new ForbiddenException({ code: access.reason ?? 'not_entitled' });
    const level = await this.resolveUserLevel(context);
    if (!canPublishProject(level)) throw new ForbiddenException({ code: 'resource_permission_denied' });
    return this.sequelize.transaction(async (transaction) => {
      const project = await this.projects.findOne({
        where: { tenant_uid: context.tenantUid, id: projectId },
        transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!project) throw new NotFoundException({ code: 'resource_not_found' });
      const draft = this.parseConfig(project.draft_config);
      try {
        assertValidTemplate(draft);
        await this.assertDigestIntegrations(context.tenantUid, draft);
      } catch (error) {
        this.mapEditorError(error);
      }
      const active = project.active_version_id
        ? await this.versions.findOne({
          where: { id: project.active_version_id, tenant_uid: context.tenantUid },
          transaction,
        })
        : null;
      const publishedConfig = active ? this.parseConfig(active.config) : null;
      const bump = stampChanged(publishedConfig, draft);

      if (!bump && active) {
        active.config = JSON.stringify(draft);
        active.config_digest = configDigest(draft);
        active.stt_revision_id = draft.sttRevisionId;
        active.llm_revision_id = draft.llmRevisionId;
        await active.save({ transaction });
        project.status = 'active';
        project.updated_at = new Date();
        await project.save({ transaction });
        return active;
      }

      const count = await this.versions.count({ where: { project_id: projectId }, transaction });
      const version = await this.versions.create({
        id: randomUUID(), tenant_uid: context.tenantUid, project_id: projectId,
        version_no: count + 1, config_digest: configDigest(draft), config: JSON.stringify(draft),
        stt_revision_id: draft.sttRevisionId, llm_revision_id: draft.llmRevisionId,
        created_by: this.userId(context), created_at: new Date(),
      }, { transaction });
      project.active_version_id = version.id;
      project.status = 'active';
      project.updated_at = new Date();
      await project.save({ transaction });
      return version;
    });
  }

  async deleteProject(context: TenantContext, projectId: string): Promise<{ deleted: true; effects: ReturnType<typeof planDeleteProjectEffects> }> {
    if (context.principalKind === 'integration') throw new ForbiddenException({ code: 'resource_permission_denied' });
    const level = await this.resolveUserLevel(context);
    if (!canDeleteProject(level)) throw new ForbiddenException({ code: 'resource_permission_denied' });
    const effects = planDeleteProjectEffects();
    await this.assertScope(context, projectId, 'analytics:read');

    await this.sequelize.transaction(async (transaction) => {
      const project = await this.projects.findOne({
        where: { tenant_uid: context.tenantUid, id: projectId },
        transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!project) throw new NotFoundException({ code: 'resource_not_found' });

      // Keep conversations (recordings/runs untouched). Clear route selection (D-31).
      if (effects.clearRouteSelection) {
        const routes = await this.routes.findAll({
          where: { user_uid: context.tenantUid },
          transaction,
        });
        for (const route of routes) {
          const next = clearRouteAnalyticsProject(route.options as Record<string, unknown> | null, projectId);
          if (JSON.stringify(next) !== JSON.stringify(route.options)) {
            route.options = next;
            await route.save({ transaction });
          }
        }
      }

      // Revoke API tokens granted to this project (D-31).
      if (effects.revokeTokens) {
        const grants = await this.grants.findAll({
          where: {
            tenant_uid: context.tenantUid,
            resource_kind: 'project',
            resource_id: projectId,
          },
          transaction,
        });
        const principalIds = [...new Set(grants.map((g) => g.principal_id))];
        const now = new Date();
        if (principalIds.length) {
          await this.credentials.update(
            { revoked_at: now },
            {
              where: {
                tenant_uid: context.tenantUid,
                principal_id: { [Op.in]: principalIds },
                revoked_at: null,
              },
              transaction,
            },
          );
          await this.principals.update(
            { status: 'disabled', updated_at: now },
            {
              where: {
                tenant_uid: context.tenantUid,
                id: { [Op.in]: principalIds },
                product: 'speech_analytics',
              },
              transaction,
            },
          );
        }
      }

      project.status = 'archived';
      project.updated_at = new Date();
      await project.save({ transaction });
    });

    return { deleted: true, effects };
  }

  /** Hard-delete a project that has no conversations. History rows block this. */
  async purgeProject(context: TenantContext, projectId: string): Promise<{ deleted: true }> {
    if (context.principalKind === 'integration') throw new ForbiddenException({ code: 'resource_permission_denied' });
    const level = await this.resolveUserLevel(context);
    if (!canDeleteProject(level)) throw new ForbiddenException({ code: 'resource_permission_denied' });
    await this.assertScope(context, projectId, 'analytics:read');
    const tenantUid = context.tenantUid;
    const recordings = await this.recordings.count({ where: { tenant_uid: tenantUid, project_id: projectId } });
    if (recordings > 0) throw new ConflictException({ code: 'project_has_recordings' });

    await this.sequelize.transaction(async (transaction) => {
      const project = await this.projects.findOne({
        where: { tenant_uid: tenantUid, id: projectId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!project) throw new NotFoundException({ code: 'resource_not_found' });
      const again = await this.recordings.count({ where: { tenant_uid: tenantUid, project_id: projectId }, transaction });
      if (again > 0) throw new ConflictException({ code: 'project_has_recordings' });

      const drop = async (sql: string) => {
        await this.sequelize.query(sql, { replacements: { tenantUid, projectId }, transaction });
      };
      await drop(`DELETE FROM sa_report_snapshot_items WHERE vpbx_user_uid = :tenantUid AND run_id IN (SELECT id FROM sa_report_runs WHERE vpbx_user_uid = :tenantUid AND definition_id IN (SELECT id FROM sa_report_definitions WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId))`);
      await drop(`DELETE FROM sa_report_schedules WHERE vpbx_user_uid = :tenantUid AND definition_id IN (SELECT id FROM sa_report_definitions WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId)`);
      await drop(`DELETE FROM sa_report_runs WHERE vpbx_user_uid = :tenantUid AND definition_id IN (SELECT id FROM sa_report_definitions WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId)`);
      await drop(`DELETE FROM sa_report_definitions WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId`);
      await drop(`DELETE FROM sa_bulk_reanalysis_items WHERE vpbx_user_uid = :tenantUid AND batch_id IN (SELECT id FROM sa_bulk_reanalysis_batches WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId)`);
      await drop(`DELETE FROM sa_bulk_reanalysis_batches WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId`);
      await drop(`DELETE FROM sa_budget_policies WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId`);
      await drop(`DELETE FROM sa_insights_requests WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId`);
      await drop(`DELETE FROM sa_insights_cache WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId`);
      await drop(`DELETE FROM ai_webhook_deliveries WHERE vpbx_user_uid = :tenantUid AND endpoint_id IN (SELECT id FROM ai_webhook_endpoints WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId)`);
      await drop(`DELETE FROM ai_webhook_endpoints WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId`);
      await drop(`DELETE FROM sa_project_version_metrics WHERE vpbx_user_uid = :tenantUid AND project_version_id IN (SELECT id FROM sa_project_versions WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId)`);
      await drop(`DELETE FROM sa_metric_revisions WHERE vpbx_user_uid = :tenantUid AND definition_id IN (SELECT id FROM sa_metric_definitions WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId)`);
      await drop(`DELETE FROM sa_metric_definitions WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId`);
      await drop(`DELETE FROM sa_project_versions WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId`);
      await drop(`DELETE FROM sa_project_members WHERE vpbx_user_uid = :tenantUid AND project_id = :projectId`);
      await project.destroy({ transaction });
    });
    return { deleted: true };
  }

  async testProjectWebhook(context: TenantContext, projectId: string) {
    const project = await this.assertScope(context, projectId, 'analytics:read');
    if (context.principalKind === 'integration') throw new ForbiddenException({ code: 'resource_permission_denied' });
    const config = this.parseConfig(project.draft_config);
    const targets = [
      ...saEventWebhookTargets(config, 'analysis.completed'),
      ...saEventWebhookTargets(config, 'analysis.error'),
      ...saEventWebhookTargets(config, 'budget.exceeded'),
      ...saEventWebhookTargets(config, 'anomaly.detected'),
    ];
    const unique = targets.filter((row, index) => targets.findIndex((item) => item.url === row.url) === index);
    if (!unique.length) {
      throw new UnprocessableEntityException({ code: 'webhook_url_required' });
    }
    const results = [];
    for (const target of unique) {
      results.push(await testSaEventWebhook(axiosSaHttpPoster, {
        url: target.url,
        headers: target.headers,
        projectId,
      }));
    }
    return { results };
  }

  private async deliverToIntegrations(
    tenantUid: number,
    uids: number[],
    message: string,
    attach?: { filename: string; content: string; contentType: string },
  ): Promise<number> {
    if (!uids.length) {
      throw new UnprocessableEntityException({ code: 'digest_recipient_required' });
    }
    const owned = await this.integrations.findAll({
      where: { uid: { [Op.in]: uids }, user_uid: tenantUid },
    });
    if (!owned.length) {
      throw new UnprocessableEntityException({ code: 'digest_recipient_required' });
    }
    const byUid = new Map(owned.map((row) => [row.uid, row]));
    const targets = [...new Set(uids)].map((uid) => byUid.get(uid)).filter((row) => row != null);
    let sent = 0;
    let firstError = 'notify_failed';
    for (const row of targets) {
      this.logger.log(`speech analytics notify integration=${row.uid} channel=${row.channel}`);
      const result = await this.notifications.dispatch({
        integration_uid: row.uid,
        subject: 'Речевая аналитика',
        message,
        ...(attach ? { attach } : {}),
      });
      if (result?.success) {
        sent += 1;
        continue;
      }
      firstError = result?.error || firstError;
      this.logger.warn(
        `speech analytics notify failed integration=${row.uid} error=${result?.error ?? 'no_result'}`,
      );
    }
    if (!sent) {
      throw new UnprocessableEntityException({ code: firstError });
    }
    return sent;
  }

  async sendProjectDigest(context: TenantContext, projectId: string) {
    const project = await this.assertScope(context, projectId, 'analytics:write');
    const config = this.parseConfig(project.draft_config);
    const recipients = await this.deliverToIntegrations(
      context.tenantUid,
      config.digest.integrationUids ?? [],
      'Тестовая сводка речевой аналитики',
    );
    const next = {
      ...config,
      digest: { ...config.digest, lastManualSentAt: new Date().toISOString() },
    };
    const saved = await this.updateDraft(context, projectId, project.draft_revision, next);
    return { sent: true, recipients, draftRevision: saved.draft_revision };
  }

  async testProjectAlert(context: TenantContext, projectId: string) {
    const project = await this.assertScope(context, projectId, 'analytics:write');
    const config = this.parseConfig(project.draft_config);
    const uids = config.alerts.integrationUids?.length
      ? config.alerts.integrationUids
      : (config.digest.integrationUids ?? []);
    const recipients = await this.deliverToIntegrations(
      context.tenantUid,
      uids,
      'Тестовое уведомление речевой аналитики',
    );
    const next = {
      ...config,
      alerts: { ...config.alerts, lastTestSentAt: new Date().toISOString() },
    };
    const saved = await this.updateDraft(context, projectId, project.draft_revision, next);
    return { sent: true, recipients, draftRevision: saved.draft_revision };
  }

  async evaluateProjectBudget(context: TenantContext, projectId: string, period?: { from?: string; to?: string }) {
    const project = await this.assertScope(context, projectId, 'analytics:read');
    const config = this.parseConfig(
      project.active_version_id
        ? ((await this.versions.findByPk(project.active_version_id))?.config ?? project.draft_config)
        : project.draft_config,
    );
    const to = period?.to ? new Date(period.to) : new Date();
    const from = period?.from
      ? new Date(period.from)
      : new Date(to.getTime() - 30 * 86400000);
    const recordings = await this.recordings.findAll({
      where: { tenant_uid: context.tenantUid, project_id: projectId },
      attributes: ['id'],
    });
    const recordingIds = recordings.map((r) => r.id);
    const runs = recordingIds.length
      ? await this.runs.findAll({
        where: {
          tenant_uid: context.tenantUid,
          recording_id: { [Op.in]: recordingIds },
          amount: { [Op.ne]: null },
        },
        attributes: ['amount', 'currency', 'created_at'],
      })
      : [];
    const currency = runs.find((r) => r.currency)?.currency ?? 'RUB';
    const spent = sumSaChargeRunAmounts(
      runs.map((r) => ({
        amount: r.amount,
        currency: r.currency,
        createdAt: r.created_at,
      })),
      { from, to },
      currency,
    );
    const result = evaluateBudgetSoftLimit({
      softLimit: config.budget?.softLimit ?? 0,
      spent,
    });
    if (result.shouldWebhook) {
      const targets = saEventWebhookTargets(config, 'budget.exceeded');
      for (const target of targets) {
        await enqueueSaEventWebhook(this.webhooks, {
          url: target.url,
          headers: target.headers,
          event: 'budget.exceeded',
          projectId,
          data: { spent, softLimit: result.softLimit, currency },
        });
      }
    }
    return { ...result, currency, period: { from: from.toISOString(), to: to.toISOString() } };
  }

  mapEditorError(error: unknown): never {
    if (error instanceof ProjectEditorError) {
      throw new HttpException({ code: error.code }, error.status);
    }
    throw error;
  }

  async allocateUpload(context: TenantContext, projectId: string, expectedBytes?: number): Promise<{ id: string; expiresAt: string }> {
    await this.assertScope(context, projectId, 'analytics:upload');
    const now = new Date();
    const assetId = randomUUID();
    const asset = await this.assets.create({
      id: assetId, tenant_uid: context.tenantUid, source_kind: 'upload',
      storage_key: `krs:v1:local:${context.tenantUid}:${assetId}`,
      state: 'allocated', sha256: null, bytes: 0, duration_ms: null, media_metadata: '{}',
      retention_at: null, parent_asset_id: null, deleted_at: null, version: 1,
      created_at: now, updated_at: now,
    });
    const upload = await this.uploads.create({
      id: randomUUID(), tenant_uid: context.tenantUid, principal_id: context.principalId,
      resource_kind: 'project', resource_id: projectId, asset_id: asset.id, state: 'allocated',
      expected_bytes: expectedBytes ?? null, expected_checksum: null, received_bytes: 0,
      expires_at: new Date(now.getTime() + 60 * 60 * 1000),
      request_hash: uploadChecksum(Buffer.from(`${context.tenantUid}:${asset.id}`)),
      version: 1, created_at: now, updated_at: now,
    });
    return { id: upload.id, expiresAt: upload.expires_at.toISOString() };
  }

  async putUploadContent(context: TenantContext, uploadId: string, body: Buffer): Promise<{ receivedBytes: number }> {
    const upload = await this.uploads.findOne({ where: { tenant_uid: context.tenantUid, id: uploadId } });
    if (!upload || upload.principal_id !== context.principalId) throw new NotFoundException({ code: 'resource_not_found' });
    await this.assertScope(context, upload.resource_id, 'analytics:upload');
    if (body.length > 50 * 1024 * 1024) throw new PayloadTooLargeException({ code: 'upload_overflow' });
    const asset = await this.assets.findOne({ where: { tenant_uid: context.tenantUid, id: upload.asset_id } });
    if (!asset) throw new NotFoundException({ code: 'resource_not_found' });
    // Close the skeleton gap: persist bytes for later analysis (D-14).
    this.uploadBodies.set(asset.id, Buffer.from(body));
    asset.sha256 = uploadChecksum(body);
    asset.bytes = String(body.length);
    asset.state = 'uploading';
    asset.media_metadata = JSON.stringify({ stored: true, bytes: body.length });
    await asset.save();
    upload.received_bytes = String(body.length);
    upload.state = 'uploading';
    await upload.save();
    return { receivedBytes: body.length };
  }

  /** Bytes previously stored by putUploadContent (same asset - no second copy). */
  getStoredUploadBytes(assetId: string): Buffer | null {
    return this.uploadBodies.get(assetId) ?? null;
  }

  async completeUpload(context: TenantContext, uploadId: string, checksum?: string): Promise<{ status: number; assetId: string; state: string }> {
    const upload = await this.uploads.findOne({ where: { tenant_uid: context.tenantUid, id: uploadId } });
    if (!upload || upload.principal_id !== context.principalId) throw new NotFoundException({ code: 'resource_not_found' });
    await this.assertScope(context, upload.resource_id, 'analytics:upload');
    const asset = await this.assets.findOne({ where: { tenant_uid: context.tenantUid, id: upload.asset_id } });
    if (!asset) throw new NotFoundException({ code: 'resource_not_found' });
    if (checksum && asset.sha256 !== checksum.toLowerCase()) {
      throw new UnprocessableEntityException({ code: 'checksum_mismatch' });
    }
    asset.state = 'ready';
    await asset.save();
    upload.state = 'completed';
    await upload.save();
    return { status: 200, assetId: asset.id, state: 'ready' };
  }

  async getUpload(context: TenantContext, uploadId: string) {
    const upload = await this.uploads.findOne({ where: { tenant_uid: context.tenantUid, id: uploadId } });
    if (!upload || upload.principal_id !== context.principalId) throw new NotFoundException({ code: 'resource_not_found' });
    await this.assertScope(context, upload.resource_id, 'analytics:upload');
    return upload;
  }

  async createRun(context: TenantContext, input: {
    projectId: string; assetId: string; externalCallId?: string; sourcePart?: string;
    metadata?: Record<string, unknown>; idempotencyKey: string;
    configSource?: 'draft' | 'published';
  }) {
    try {
    const project = await this.assertScope(context, input.projectId, 'analytics:upload');
    if (project.status === 'archived') {
      throw new ConflictException({ code: 'project_archived' });
    }
    const useDraft = input.configSource === 'draft';
    const draft = this.parseConfig(project.draft_config);
    let publishedConfig: SaProjectConfigV1 | null = null;
    if (project.active_version_id) {
      const published = await this.versions.findOne({
        where: { id: project.active_version_id, tenant_uid: context.tenantUid },
      });
      if (published?.config) {
        try { publishedConfig = JSON.parse(published.config) as SaProjectConfigV1; } catch { publishedConfig = null; }
      }
    }
    if (!useDraft && !project.active_version_id) {
      throw new ConflictException({ code: 'project_not_published' });
    }
    await this.assertAnalysisProviders(context.tenantUid, useDraft ? draft : publishedConfig);
    const asset = await this.assets.findOne({ where: { tenant_uid: context.tenantUid, id: input.assetId } });
    if (!asset) throw new NotFoundException({ code: 'resource_not_found' });
    if (asset.state !== 'ready') throw new ConflictException({ code: 'asset_not_ready' });
    const access = await this.products.decide(context.tenantUid, 'speech_analytics');
    const stores = emptyIngestStores();
    stores.assets.set(asset.id, {
      id: asset.id, tenantUid: context.tenantUid, state: asset.state, sha256: asset.sha256 ?? '',
    });
    const accepted = await this.sequelize.transaction(async (transaction) => {
    let versionId = project.active_version_id;
    if (useDraft) {
      const sameAsPublished = Boolean(
        project.active_version_id
        && publishedConfig
        && configDigest(draft) === configDigest(publishedConfig),
      );
      if (!sameAsPublished) {
        const count = await this.versions.count({ where: { project_id: project.id }, transaction });
        const snapshot = await this.versions.create({
          id: randomUUID(), tenant_uid: context.tenantUid, project_id: project.id,
          version_no: count + 1, config_digest: configDigest(draft), config: JSON.stringify(draft),
          stt_revision_id: draft.sttRevisionId, llm_revision_id: draft.llmRevisionId,
          created_by: this.userId(context), created_at: new Date(),
        }, { transaction });
        versionId = snapshot.id;
      }
    }
    if (!versionId) throw new ConflictException({ code: 'project_not_published' });
    const recordingClaim = claimRecording({
      stores,
      tenantUid: context.tenantUid,
      principalId: context.principalId,
      project: {
        id: project.id, tenantUid: project.tenant_uid, name: project.name,
        status: project.status as 'draft' | 'active' | 'archived',
        draftRevision: project.draft_revision, draftConfig: defaultSaProjectConfig(),
        activeVersionId: versionId, createdBy: project.created_by,
      },
      externalCallId: input.externalCallId ?? randomUUID(),
      sourcePart: input.sourcePart ?? 'main',
      assetId: asset.id,
      metadata: metadataAllowlist(input.metadata ?? {}),
    });
      let recording = await this.recordings.findOne({
        where: {
          tenant_uid: context.tenantUid, project_id: project.id,
          integration_principal_id: context.principalId,
          business_key_hash: recordingClaim.businessKeyHash,
        },
        transaction, lock: transaction.LOCK.UPDATE,
      });
      if (recording && recording.content_digest !== asset.sha256) {
        throw new ConflictException({ code: 'recording_conflict' });
      }
      if (!recording) {
        try {
          recording = await this.recordings.create({
            id: recordingClaim.id, tenant_uid: context.tenantUid, project_id: project.id,
            integration_principal_id: context.principalId, external_call_id: recordingClaim.externalCallId,
            source_part: recordingClaim.sourcePart, business_key_hash: recordingClaim.businessKeyHash,
            asset_id: asset.id, metadata: recordingClaim.metadata, content_digest: asset.sha256,
            occurred_at: new Date(), created_at: new Date(),
          }, { transaction });
        } catch (error) {
          if (!(error instanceof UniqueConstraintError)) throw error;
          recording = await this.recordings.findOne({
            where: {
              tenant_uid: context.tenantUid, project_id: project.id,
              integration_principal_id: context.principalId,
              business_key_hash: recordingClaim.businessKeyHash,
            },
            transaction,
          });
        }
      }
      if (!recording) throw new ConflictException({ code: 'recording_conflict' });
      const existingRun = await this.runs.findOne({ where: { recording_id: recording.id }, transaction });
      if (existingRun) {
        return { status: 202, runId: existingRun.id, recordingId: recording.id,
          projectVersionId: existingRun.project_version_id, replay: true };
      }
      await releaseFinishedSpeechJobs(context.tenantUid, this.runs, this.admission, transaction);
      const receipt = await this.admission.admit({
        tenantUid: context.tenantUid, principalId: context.principalId,
        product: 'speech_analytics', kind: 'analyze', resourceKind: 'project',
        resourceId: project.id, idempotencyKey: input.idempotencyKey,
        request: { recordingId: recording.id, assetId: asset.id },
        entitled: access.allowed, now: new Date(),
      }, transaction);
      const run = await this.runs.create({
        id: randomUUID(), tenant_uid: context.tenantUid, recording_id: recording.id,
        project_version_id: versionId, job_id: receipt.jobId, state: 'queued',
        transcript_id: null, result_id: null, parent_run_id: null, reason: null,
        created_at: new Date(), updated_at: new Date(),
      }, { transaction });
      return {
        status: 202, runId: run.id, recordingId: recording.id,
        projectVersionId: versionId, replay: receipt.replay,
      };
    });
    if (accepted && !accepted.replay) {
      this.enqueueUploadAnalysis(context.tenantUid, asset.id, accepted.runId, input.metadata);
    }
    return accepted;
    } catch (error) {
      this.mapError(error);
    }
  }

  /** Refuse the upload before any journal row when speech providers are not assigned. */
  private async assertAnalysisProviders(tenantUid: number, project: SaProjectConfigV1 | null): Promise<void> {
    const assignment = await this.speechProviders?.resolve(tenantUid, project);
    if (!assignment?.sttProviderUid || !assignment.llmProviderUid) {
      throw new UnprocessableEntityException({ code: 'analysis_provider_missing' });
    }
  }

  async cabinetSpeechModels(tenantUid: number) {
    if (!this.speechProviders) {
      return {
        ownModels: false, projectOverride: false,
        sttProviderUid: null, llmProviderUid: null, providers: [],
      };
    }
    const described = await this.speechProviders.describe(tenantUid);
    return {
      ownModels: described.ownModels,
      projectOverride: described.projectOverride,
      sttProviderUid: described.sttProviderUid,
      llmProviderUid: described.llmProviderUid,
      providers: described.providers,
    };
  }

  async saveCabinetSpeechModels(tenantUid: number, patch: {
    sttProviderUid?: number | null;
    llmProviderUid?: number | null;
    projectOverride?: boolean;
  }) {
    if (!this.speechProviders) return this.cabinetSpeechModels(tenantUid);
    const saved = await this.speechProviders.saveTenant(tenantUid, patch);
    return {
      ownModels: saved.ownModels,
      projectOverride: saved.projectOverride,
      sttProviderUid: saved.sttProviderUid,
      llmProviderUid: saved.llmProviderUid,
      providers: saved.providers,
    };
  }

  /** Keep cabinet uploads off the request and run one analysis at a time per tenant. */
  private enqueueUploadAnalysis(
    tenantUid: number,
    assetId: string,
    runId: string,
    metadata?: Record<string, unknown>,
  ): void {
    const prev = this.uploadQueue.get(tenantUid) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(() => this.startUploadAnalysis(tenantUid, assetId, runId, metadata));
    this.uploadQueue.set(tenantUid, next);
    void next.finally(() => {
      if (this.uploadQueue.get(tenantUid) === next) this.uploadQueue.delete(tenantUid);
    });
  }

  /**
   * Cabinet upload returns as soon as the run is queued. STT and scoring continue
   * here. A failure marks the run failed and leaves it out of the journal list.
   */
  private async startUploadAnalysis(
    tenantUid: number,
    assetId: string,
    runId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      if (!this.worker) {
        throw new Error('worker is not registered');
      }
      const bytes = this.getStoredUploadBytes(assetId);
      if (!bytes?.length) {
        throw new Error(`no audio bytes for asset ${assetId}`);
      }
      const filename = typeof metadata?.filename === 'string' ? metadata.filename : 'audio.wav';
      const ext = path.extname(filename).toLowerCase();
      const safeExt = ext === '.mp3' || ext === '.wav' || ext === '.ogg' || ext === '.m4a' ? ext : '.wav';
      const filePath = path.join(os.tmpdir(), 'sa-uploads', `${assetId}${safeExt}`);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, bytes);
      this.uploadBodies.delete(assetId);
      const outcome = await this.worker.processJob({
        jobId: runId,
        runId,
        recordPath: filePath,
        tenantUid,
        channelSource: 'upload',
      });
      if (outcome.state !== 'completed' || outcome.scored !== true) {
        await this.markUploadFailed(tenantUid, runId, outcome.reason || outcome.state || 'analysis_failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Upload analysis failed run=${runId}: ${message}`);
      this.uploadBodies.delete(assetId);
      await this.markUploadFailed(tenantUid, runId, 'analysis_failed');
    }
  }

  private async markUploadFailed(tenantUid: number, runId: string, reason: string): Promise<void> {
    const run = await this.runs.findOne({ where: { tenant_uid: tenantUid, id: runId } });
    if (!run || run.state === 'completed') return;
    run.state = 'failed';
    run.reason = reason.slice(0, 64);
    run.updated_at = new Date();
    await run.save();
    if (run.job_id) {
      await this.admission.settle(tenantUid, run.job_id, 'failed').catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Could not close analysis job ${run.job_id}: ${message}`);
      });
    }
  }

  async getRun(context: TenantContext, runId: string, scope: 'analytics:read' | 'analytics:transcript' | 'analytics:audio') {
    const run = await this.runs.findOne({ where: { tenant_uid: context.tenantUid, id: runId } });
    if (!run) throw new NotFoundException({ code: 'resource_not_found' });
    const recording = await this.recordings.findOne({ where: { tenant_uid: context.tenantUid, id: run.recording_id } });
    if (!recording) throw new NotFoundException({ code: 'resource_not_found' });
    await this.assertScope(context, recording.project_id, scope);
    const result = run.result_id
      ? await this.results.findOne({ where: { tenant_uid: context.tenantUid, id: run.result_id } })
      : null;
    const transcript = scope === 'analytics:transcript' && run.transcript_id
      ? await this.transcripts.findOne({ where: { tenant_uid: context.tenantUid, id: run.transcript_id } })
      : null;
    return { run, recording, result, transcript };
  }

  async cancelRun(context: TenantContext, runId: string) {
    const run = await this.runs.findOne({ where: { tenant_uid: context.tenantUid, id: runId } });
    if (!run) throw new NotFoundException({ code: 'resource_not_found' });
    const recording = await this.recordings.findOne({ where: { tenant_uid: context.tenantUid, id: run.recording_id } });
    if (!recording) throw new NotFoundException({ code: 'resource_not_found' });
    await this.assertScope(context, recording.project_id, 'analytics:cancel');
    if (run.state === 'queued' || run.state === 'running' || run.state === 'retry_wait') {
      run.state = 'cancelled';
      run.updated_at = new Date();
      await run.save();
    }
    return run;
  }

  async listRecordings(context: TenantContext, projectId: string, _cursor?: string) {
    await this.assertScope(context, projectId, 'analytics:read');
    const where: Record<string, unknown> = { tenant_uid: context.tenantUid, project_id: projectId };
    return this.recordings.findAll({
      where, order: [['occurred_at', 'DESC'], ['id', 'DESC']], limit: 25,
    });
  }

  async capabilities() {
    return {
      containers: ['wav', 'flac', 'mp3'],
      maxBytes: 256 * 1024 * 1024,
      maxDurationMs: 30 * 60 * 1000,
      channels: [1, 2],
      rubric: ['greeting_present', 'next_step_agreed', 'topic'],
      reanalysis: true,
      humanReview: true,
      reporting: true,
      nativeCaptureApply: process.env.DURABLE_CAPTURE === '1',
    };
  }

  analyzeFixture(fixtureId: string) {
    return runPipeline({ durationMs: 8000, channels: 1, stereoVerified: false, fixtureId });
  }

  mapError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof DomainError) throw new HttpException({ code: error.code }, error.status);
    if (error && typeof error === 'object' && 'status' in error && 'code' in error) {
      const mapped = error as { status: number; code: string };
      throw new HttpException({ code: mapped.code }, mapped.status);
    }
    throw error;
  }
}

export function assertUuid(value: string): void {
  if (!UUID.test(value)) throw new NotFoundException({ code: 'resource_not_found' });
}
