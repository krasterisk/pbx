import {
  ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { createHash, randomUUID } from 'node:crypto';
import { UniqueConstraintError } from 'sequelize';
import { AiJobAdmissionService } from '../../ai-jobs/ai-job-admission.service';
import { ProductAccessService } from '../../product-access/product-access.service';
import { ProductResourceAuthorization } from '../../integration-credentials/product-resource.authorization';
import type { TenantContext } from '../../integration-credentials/tenant-context';
import { DomainError } from '../project-engine';
import {
  assertRubric, overallScore, publishMetric, scoreMetric, type MetricRubric,
} from './metric-engine';
import {
  SaHumanReview, SaMetricDefinition, SaMetricRevision, SaMetricValue,
  SaProjectVersionMetric, SaTranscriptCorrection,
} from './metric.models';
import { SaAnalysisRun, SaProject, SaProjectVersion, SaTranscript } from '../speech-analytics.models';

@Injectable()
export class SaMetricsService {
  constructor(
    private readonly products: ProductAccessService,
    private readonly resources: ProductResourceAuthorization,
    private readonly admission: AiJobAdmissionService,
    @InjectModel(SaProject) private readonly projects: typeof SaProject,
    @InjectModel(SaProjectVersion) private readonly versions: typeof SaProjectVersion,
    @InjectModel(SaAnalysisRun) private readonly runs: typeof SaAnalysisRun,
    @InjectModel(SaTranscript) private readonly transcripts: typeof SaTranscript,
    @InjectModel(SaMetricDefinition) private readonly definitions: typeof SaMetricDefinition,
    @InjectModel(SaMetricRevision) private readonly revisions: typeof SaMetricRevision,
    @InjectModel(SaProjectVersionMetric) private readonly bindings: typeof SaProjectVersionMetric,
    @InjectModel(SaMetricValue) private readonly values: typeof SaMetricValue,
    @InjectModel(SaHumanReview) private readonly reviews: typeof SaHumanReview,
    @InjectModel(SaTranscriptCorrection) private readonly corrections: typeof SaTranscriptCorrection,
  ) {}

  private mapError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof DomainError) throw new HttpException({ code: error.code }, error.status);
    throw error;
  }

  private async project(context: TenantContext, projectId: string, scope: string): Promise<SaProject> {
    await this.resources.authorize(context, {
      product: 'speech_analytics', action: scope, resourceKind: 'project', resourceId: projectId,
    });
    const row = await this.projects.findOne({ where: { tenant_uid: context.tenantUid, id: projectId } });
    if (!row) throw new NotFoundException({ code: 'resource_not_found' });
    return row;
  }

  async list(context: TenantContext, projectId: string) {
    await this.project(context, projectId, 'analytics:read');
    return this.definitions.findAll({
      where: { tenant_uid: context.tenantUid, project_id: projectId },
      order: [['metric_key', 'ASC']],
    });
  }

  async publish(context: TenantContext, projectId: string, operationKey: string, rubric: MetricRubric) {
    try {
      await this.project(context, projectId, 'analytics:configure');
      assertRubric(rubric);
      const previous = await this.revisions.findAll({ where: { tenant_uid: context.tenantUid } });
      const replayed = previous.find(row => {
        try { return JSON.parse(row.rubric).operationKey === operationKey; } catch { return false; }
      });
      if (replayed) return { definitionId: replayed.definition_id, revisionId: replayed.id, replay: true };
      const existing = await this.definitions.findOne({
        where: { tenant_uid: context.tenantUid, project_id: projectId, metric_key: rubric.key },
      });
      if (existing) {
        const last = await this.revisions.findOne({
          where: { definition_id: existing.id }, order: [['revision', 'DESC']],
        });
        if (last) {
          const prior = JSON.parse(last.rubric) as MetricRubric;
          if (prior.type !== rubric.type) throw new DomainError('type_mismatch', 409);
        }
      }
      const definition = existing ?? await this.definitions.create({
        id: randomUUID(), tenant_uid: context.tenantUid, project_id: projectId,
        metric_key: rubric.key, archived_at: null, created_at: new Date(),
      });
      const count = await this.revisions.count({ where: { definition_id: definition.id } });
      const published = publishMetric({
        stores: { definitions: new Map(), revisions: new Map(), published: new Map() },
        projectId, rubric, operationKey,
      });
      void published;
      const revision = await this.revisions.create({
        id: randomUUID(), tenant_uid: context.tenantUid, definition_id: definition.id,
        revision: count + 1, schema_digest: createHash('sha256')
          .update(JSON.stringify(rubric)).digest('hex'),
        rubric: JSON.stringify({ ...rubric, operationKey }), created_at: new Date(),
      });
      return { definitionId: definition.id, revisionId: revision.id, replay: false };
    } catch (error) {
      this.mapError(error);
    }
  }

  scoreFixture(rubric: MetricRubric, input: Parameters<typeof scoreMetric>[1]) {
    const scored = scoreMetric(rubric, input);
    return { ...scored, overall: overallScore([{ weight: rubric.weight, status: scored.status, normalised: scored.normalised }]) };
  }

  async reanalyze(context: TenantContext, runId: string, input: {
    projectVersionId: string; reason: string; idempotencyKey: string;
  }) {
    try {
      const run = await this.runs.findOne({ where: { tenant_uid: context.tenantUid, id: runId } });
      if (!run) throw new NotFoundException({ code: 'resource_not_found' });
      const version = await this.versions.findOne({
        where: { tenant_uid: context.tenantUid, id: input.projectVersionId },
      });
      if (!version) throw new NotFoundException({ code: 'resource_not_found' });
      await this.project(context, version.project_id, 'analytics:reanalyze');
      const access = await this.products.decide(context.tenantUid, 'speech_analytics');
      if (!access.allowed) throw new ForbiddenException({ code: access.reason ?? 'not_entitled' });
      const receipt = await this.admission.admit({
        tenantUid: context.tenantUid, principalId: context.principalId,
        product: 'speech_analytics', kind: 'reanalyze', resourceKind: 'project',
        resourceId: version.project_id, idempotencyKey: input.idempotencyKey || randomUUID(),
        request: { parentRunId: run.id, projectVersionId: input.projectVersionId },
        entitled: access.allowed, now: new Date(),
      });
      const child = await this.runs.create({
        id: randomUUID(), tenant_uid: context.tenantUid, recording_id: run.recording_id,
        project_version_id: input.projectVersionId, job_id: receipt.jobId, state: 'queued',
        transcript_id: run.transcript_id, result_id: null, parent_run_id: run.id,
        reason: input.reason, created_at: new Date(), updated_at: new Date(),
      });
      return { runId: child.id, parentRunId: run.id, originalResultId: run.result_id };
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw new ConflictException({ code: 'duplicate_command' });
      this.mapError(error);
    }
  }

  async review(context: TenantContext, runId: string, input: {
    metricRevisionId: string; value: string; status: 'accepted' | 'rejected' | 'cancelled';
    reason: string; commandKey: string; expectedRevision: number;
  }) {
    try {
      const run = await this.runs.findOne({ where: { tenant_uid: context.tenantUid, id: runId } });
      if (!run) throw new NotFoundException({ code: 'resource_not_found' });
      const version = await this.versions.findOne({
        where: { tenant_uid: context.tenantUid, id: run.project_version_id },
      });
      if (!version) throw new NotFoundException({ code: 'resource_not_found' });
      await this.project(context, version.project_id, 'analytics:review');
      const actor = /^user:(\d+)$/.exec(context.principalId);
      if (!actor) throw new ForbiddenException({ code: 'tenant_admin_required' });
      return await this.reviews.create({
        id: randomUUID(), tenant_uid: context.tenantUid, run_id: runId,
        metric_revision_id: input.metricRevisionId, expected_review_revision: input.expectedRevision,
        value: input.value, status: input.status, reason: input.reason,
        actor_user_id: Number(actor[1]), supersedes_id: null, command_key: input.commandKey,
        created_at: new Date(),
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw new ConflictException({ code: 'duplicate_command' });
      this.mapError(error);
    }
  }

  async correctTranscript(context: TenantContext, transcriptId: string, input: {
    text: string; reason: string;
  }) {
    const transcript = await this.transcripts.findOne({
      where: { tenant_uid: context.tenantUid, id: transcriptId },
    });
    if (!transcript) throw new NotFoundException({ code: 'resource_not_found' });
    const run = await this.runs.findOne({ where: { transcript_id: transcriptId, tenant_uid: context.tenantUid } });
    if (!run) throw new NotFoundException({ code: 'resource_not_found' });
    const version = await this.versions.findOne({
      where: { id: run.project_version_id, tenant_uid: context.tenantUid },
    });
    if (!version) throw new NotFoundException({ code: 'resource_not_found' });
    await this.project(context, version.project_id, 'analytics:transcript');
    const actor = /^user:(\d+)$/.exec(context.principalId);
    if (!actor) throw new ForbiddenException({ code: 'tenant_admin_required' });
    const revision = (await this.corrections.count({ where: { transcript_id: transcriptId } })) + 1;
    return this.corrections.create({
      id: randomUUID(), tenant_uid: context.tenantUid, transcript_id: transcriptId,
      revision, text: input.text, author_user_id: Number(actor[1]), reason: input.reason,
      created_at: new Date(),
    });
  }
}
