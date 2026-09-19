import {
  ConflictException, ForbiddenException, HttpException, Injectable,
  NotFoundException, PayloadTooLargeException, UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'node:crypto';
import { Sequelize } from 'sequelize-typescript';
import { UniqueConstraintError } from 'sequelize';
import {
  defaultSaProjectConfig, type SaProjectConfigV1,
} from '@krasterisk/shared';
import { AiJobAdmissionService } from '../ai-jobs/ai-job-admission.service';
import { AiMediaAsset, AiUpload } from '../media-assets/media-asset.models';
import { ProductAccessService } from '../product-access/product-access.service';
import { ProductResourceAuthorization } from '../integration-credentials/product-resource.authorization';
import { IntegrationGrant } from '../integration-credentials/integration-credential.models';
import type { TenantContext } from '../integration-credentials/tenant-context';
import { configDigest, DomainError } from './project-engine';
import { claimRecording, emptyIngestStores, metadataAllowlist, uploadChecksum } from './ingest-engine';
import { runPipeline } from './pipeline';
import {
  SaAnalysisRun, SaProject, SaProjectMember, SaProjectVersion, SaRecording, SaResult, SaTranscript,
  SaTranscriptSegment,
} from './speech-analytics.models';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class SpeechAnalyticsService {
  constructor(
    private readonly sequelize: Sequelize,
    private readonly admission: AiJobAdmissionService,
    private readonly products: ProductAccessService,
    private readonly resources: ProductResourceAuthorization,
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
  ) {}

  private userId(context: TenantContext): number {
    const match = /^user:(\d+)$/.exec(context.principalId);
    return match ? Number(match[1]) : 0;
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
    return this.projects.findAll({
      where: { tenant_uid: context.tenantUid }, order: [['created_at', 'DESC']], limit: 100,
    });
  }

  async updateDraft(context: TenantContext, projectId: string, expectedRevision: number, config: SaProjectConfigV1): Promise<SaProject> {
    const project = await this.assertScope(context, projectId, 'analytics:read');
    if (context.principalKind === 'integration') throw new ForbiddenException({ code: 'resource_permission_denied' });
    if (project.draft_revision !== expectedRevision) throw new ConflictException({ code: 'stale_draft' });
    project.draft_config = JSON.stringify(config);
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
    return this.sequelize.transaction(async (transaction) => {
      const project = await this.projects.findOne({
        where: { tenant_uid: context.tenantUid, id: projectId },
        transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!project) throw new NotFoundException({ code: 'resource_not_found' });
      const member = await this.members.findOne({
        where: { tenant_uid: context.tenantUid, project_id: projectId, user_id: this.userId(context) },
        transaction,
      });
      if (!member || member.role !== 'owner') throw new ForbiddenException({ code: 'resource_permission_denied' });
      const count = await this.versions.count({ where: { project_id: projectId }, transaction });
      const config = JSON.parse(project.draft_config) as SaProjectConfigV1;
      const version = await this.versions.create({
        id: randomUUID(), tenant_uid: context.tenantUid, project_id: projectId,
        version_no: count + 1, config_digest: configDigest(config), config: project.draft_config,
        stt_revision_id: config.sttRevisionId, llm_revision_id: config.llmRevisionId,
        created_by: this.userId(context), created_at: new Date(),
      }, { transaction });
      project.active_version_id = version.id;
      project.status = 'active';
      project.updated_at = new Date();
      await project.save({ transaction });
      return version;
    });
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
    if (body.length > 256 * 1024 * 1024) throw new PayloadTooLargeException({ code: 'upload_overflow' });
    const asset = await this.assets.findOne({ where: { tenant_uid: context.tenantUid, id: upload.asset_id } });
    if (!asset) throw new NotFoundException({ code: 'resource_not_found' });
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
  }) {
    try {
    const project = await this.assertScope(context, input.projectId, 'analytics:upload');
    if (!project.active_version_id || project.status === 'archived') {
      throw new ConflictException({ code: 'project_archived' });
    }
    const asset = await this.assets.findOne({ where: { tenant_uid: context.tenantUid, id: input.assetId } });
    if (!asset) throw new NotFoundException({ code: 'resource_not_found' });
    if (asset.state !== 'ready') throw new ConflictException({ code: 'asset_not_ready' });
    const access = await this.products.decide(context.tenantUid, 'speech_analytics');
    const stores = emptyIngestStores();
    stores.assets.set(asset.id, {
      id: asset.id, tenantUid: context.tenantUid, state: asset.state, sha256: asset.sha256 ?? '',
    });
    const recordingClaim = claimRecording({
      stores,
      tenantUid: context.tenantUid,
      principalId: context.principalId,
      project: {
        id: project.id, tenantUid: project.tenant_uid, name: project.name,
        status: project.status as 'draft' | 'active' | 'archived',
        draftRevision: project.draft_revision, draftConfig: defaultSaProjectConfig(),
        activeVersionId: project.active_version_id, createdBy: project.created_by,
      },
      externalCallId: input.externalCallId ?? randomUUID(),
      sourcePart: input.sourcePart ?? 'main',
      assetId: asset.id,
      metadata: metadataAllowlist(input.metadata ?? {}),
    });
    return this.sequelize.transaction(async (transaction) => {
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
      const receipt = await this.admission.admit({
        tenantUid: context.tenantUid, principalId: context.principalId,
        product: 'speech_analytics', kind: 'analyze', resourceKind: 'project',
        resourceId: project.id, idempotencyKey: input.idempotencyKey,
        request: { recordingId: recording.id, assetId: asset.id },
        entitled: access.allowed, now: new Date(),
      }, transaction);
      const run = await this.runs.create({
        id: randomUUID(), tenant_uid: context.tenantUid, recording_id: recording.id,
        project_version_id: project.active_version_id, job_id: receipt.jobId, state: 'queued',
        transcript_id: null, result_id: null, parent_run_id: null, reason: null,
        created_at: new Date(), updated_at: new Date(),
      }, { transaction });
      return {
        status: 202, runId: run.id, recordingId: recording.id,
        projectVersionId: project.active_version_id, replay: receipt.replay,
      };
    });
    } catch (error) {
      this.mapError(error);
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
      reanalysis: false,
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
