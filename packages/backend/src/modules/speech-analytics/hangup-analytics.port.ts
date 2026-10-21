import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { createHash, randomUUID } from 'node:crypto';
import { Sequelize } from 'sequelize-typescript';
import { UniqueConstraintError, type Transaction } from 'sequelize';
import { AiJobAdmissionService } from '../ai-jobs/ai-job-admission.service';
import { AiMediaAsset } from '../media-assets/media-asset.models';
import { ProductAccessService } from '../product-access/product-access.service';
import {
  HANGUP_ANALYTICS_PORT,
  type HangupAnalysisJobInput,
  type HangupAnalyticsContext,
  type HangupAnalyticsPort,
} from '../routes/dialplan-webhooks.service';
import { ModuleSettingsService } from './module-settings.service';
import {
  SaTenantCapturePolicy,
  SaRecordingRelation,
} from './reporting/reporting.models';
import {
  SaAnalysisRun,
  SaProject,
  SaRecording,
} from './speech-analytics.models';
import type { SaAnalysisWorker } from './jobs/sa-analysis.worker';
import { internalOriginKey } from './reporting/internal-admission';
import { releaseFinishedSpeechJobs } from './release-speech-jobs';

const HANGUP_PRINCIPAL = 'system:hangup';

/** Nest token for SaAnalysisWorker - bound in sa-analysis.worker.nest.ts (G-18-02). */
export const SA_ANALYSIS_WORKER = 'SA_ANALYSIS_WORKER';

/**
 * Production HangupAnalyticsPort - resolve capture gates + enqueue sa_* rows and ai_jobs.
 * STT / runAnalysis stay in the worker (D-03). No wallet debit / CDR writes.
 */
@Injectable()
export class HangupAnalyticsPortService implements HangupAnalyticsPort {
  private readonly logger = new Logger(HangupAnalyticsPortService.name);

  constructor(
    private readonly products: ProductAccessService,
    private readonly moduleSettings: ModuleSettingsService,
    private readonly admission: AiJobAdmissionService,
    private readonly config: ConfigService,
    private readonly sequelize: Sequelize,
    @InjectModel(SaProject) private readonly projects: typeof SaProject,
    @InjectModel(SaTenantCapturePolicy)
    private readonly policies: typeof SaTenantCapturePolicy,
    @InjectModel(SaRecording) private readonly recordings: typeof SaRecording,
    @InjectModel(SaAnalysisRun) private readonly runs: typeof SaAnalysisRun,
    @InjectModel(AiMediaAsset) private readonly assets: typeof AiMediaAsset,
    @InjectModel(SaRecordingRelation)
    private readonly relations: typeof SaRecordingRelation,
    @Optional()
    @Inject(SA_ANALYSIS_WORKER)
    private readonly worker: SaAnalysisWorker | null = null,
  ) {}

  async resolveHangupContext(input: {
    tenantUid: number;
    routeUid: number;
    routeProjectId: string | null;
  }): Promise<HangupAnalyticsContext> {
    const access = await this.products.decide(
      input.tenantUid,
      'speech_analytics',
    );
    const entitled = access.allowed === true;
    const settings = this.moduleSettings.get(input.tenantUid);
    const policy = await this.policies.findOne({
      where: { tenant_uid: input.tenantUid },
    });
    const pauseNew = settings.pauseNew === true || policy?.pause_new === true;
    const policyRevision = policy?.revision ?? 1;
    // Preserve existing admission identities across the CDR integration upgrade.
    const nodeId =
      this.config.get<string>('ASTERISK_NODE_ID') ||
      this.config.get<string>('NODE_ID') ||
      'default';

    let projectActive = false;
    let projectPublished = false;
    let sameTenantProject = true;
    let recordingEnabled = true;

    const projectId = input.routeProjectId?.trim() || null;
    if (projectId) {
      const project = await this.projects.findOne({ where: { id: projectId } });
      if (!project) {
        sameTenantProject = false;
        projectActive = false;
        projectPublished = false;
      } else if (project.tenant_uid !== input.tenantUid) {
        sameTenantProject = false;
        projectActive = false;
        projectPublished = false;
      } else {
        sameTenantProject = true;
        projectActive = project.status === 'active';
        projectPublished = Boolean(project.active_version_id);
      }
    }

    const knownOrigins = await this.loadKnownOrigins(
      input.tenantUid,
      projectId,
    );

    return {
      entitled,
      pauseNew,
      privacyDenied: false,
      recordingEnabled,
      projectActive,
      projectPublished,
      sameTenantProject,
      policyRevision,
      nodeId,
      knownOrigins,
    };
  }

  async enqueueAnalysisJob(
    input: HangupAnalysisJobInput,
  ): Promise<{ jobId: string }> {
    const cdrNode = this.cdrNodeId();
    if (
      typeof input.uniqueid !== 'string' ||
      !input.uniqueid ||
      input.uniqueid.length > 64 ||
      input.uniqueid.includes('\0') ||
      typeof input.nodeId !== 'string' ||
      !input.nodeId ||
      input.nodeId.length > 64 ||
      input.nodeId.includes('\0') ||
      typeof cdrNode !== 'string' ||
      cdrNode.length > 64 ||
      cdrNode.includes('\0')
    )
      throw Object.assign(new Error('invalid_call_identity'), {
        code: 'invalid_call_identity',
        status: 400,
      });
    const origin = {
      tenantUid: input.tenantUid,
      nodeId: input.nodeId,
      recordingUid:
        input.uniqueid || input.recordPath || String(input.routeUid),
      projectId: input.projectId,
      policyRevision: input.policyRevision,
    };
    // Admission identity includes project/policy. It is not a CDR source_id.
    const originKey = internalOriginKey(origin);
    const businessKeyHash = createHash('sha256')
      .update(originKey)
      .digest('hex');

    const result = await this.sequelize.transaction(async (transaction) => {
      const project = await this.projects.findOne({
        where: { id: input.projectId, tenant_uid: input.tenantUid },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (
        !project ||
        project.status !== 'active' ||
        !project.active_version_id
      ) {
        throw Object.assign(new Error('project_inactive'), {
          code: 'project_inactive',
          status: 409,
        });
      }

      const existingRecording = await this.recordings.findOne({
        where: {
          tenant_uid: input.tenantUid,
          project_id: input.projectId,
          integration_principal_id: HANGUP_PRINCIPAL,
          business_key_hash: businessKeyHash,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existingRecording) {
        const existingRun = await this.runs.findOne({
          where: {
            tenant_uid: input.tenantUid,
            recording_id: existingRecording.id,
          },
          transaction,
        });
        if (existingRun) {
          await this.linkCdr(input, existingRecording.id, transaction);
          return {
            jobId: existingRun.job_id,
            runId: existingRun.id,
            replay: true as const,
          };
        }
      }

      const access = await this.products.decide(
        input.tenantUid,
        'speech_analytics',
      );
      if (!access.allowed) {
        throw Object.assign(new Error('product is not entitled'), {
          code: 'product_not_entitled',
          status: 403,
        });
      }

      const now = new Date();
      const storageKey = input.recordPath.endsWith('.mp3')
        ? input.recordPath
        : `${input.recordPath}.mp3`;
      // One physical recording can be analyzed under several policy revisions.
      // storage_key is globally unique; never create another asset for that file.
      const storedAsset = existingRecording
        ? null
        : await this.assets.findOne({
            where: { storage_key: storageKey },
            transaction,
          });
      if (storedAsset) {
        let metadata: { originKey?: string; recordPath?: string } = {};
        try {
          metadata = JSON.parse(storedAsset.media_metadata || '{}');
        } catch {
          /* Fail closed below. */
        }
        const callPrefix = `${input.tenantUid}:${input.nodeId}:${input.uniqueid}:`;
        if (
          storedAsset.tenant_uid !== input.tenantUid ||
          storedAsset.source_kind !== 'hangup' ||
          storedAsset.state !== 'ready' ||
          storedAsset.deleted_at ||
          (storedAsset.retention_at &&
            new Date(storedAsset.retention_at).getTime() <= now.getTime()) ||
          metadata.recordPath !== input.recordPath ||
          !metadata.originKey?.startsWith(callPrefix)
        ) {
          throw Object.assign(new Error('recording_asset_conflict'), {
            code: 'recording_asset_conflict',
            status: 409,
          });
        }
      }
      const assetId =
        existingRecording?.asset_id || storedAsset?.id || randomUUID();
      if (!existingRecording && !storedAsset)
        await this.assets.create(
          {
            id: assetId,
            tenant_uid: input.tenantUid,
            source_kind: 'hangup',
            storage_key: storageKey,
            state: 'ready',
            sha256: createHash('sha256').update(originKey).digest('hex'),
            bytes: String(0),
            duration_ms: String(Math.max(0, input.durationSec) * 1000),
            media_metadata: JSON.stringify({
              originKey,
              recordPath: input.recordPath,
            }),
            retention_at: null,
            parent_asset_id: null,
            deleted_at: null,
            version: 1,
            created_at: now,
            updated_at: now,
          },
          { transaction },
        );

      const recordingId = randomUUID();
      let recording: SaRecording;
      if (existingRecording) recording = existingRecording;
      else
        try {
          recording = await this.recordings.create(
            {
              id: recordingId,
              tenant_uid: input.tenantUid,
              project_id: input.projectId,
              integration_principal_id: HANGUP_PRINCIPAL,
              external_call_id: (input.uniqueid || originKey).slice(0, 128),
              source_part: 'main',
              business_key_hash: businessKeyHash,
              asset_id: assetId,
              metadata: JSON.stringify({
                originKey,
                routeUid: input.routeUid,
                recordPath: input.recordPath,
                nodeId: input.nodeId,
                cdrNodeId: this.cdrNodeId(),
              }),
              content_digest: businessKeyHash,
              occurred_at: now,
              created_at: now,
            },
            { transaction },
          );
        } catch (error) {
          if (!(error instanceof UniqueConstraintError)) throw error;
          const raced = await this.recordings.findOne({
            where: {
              tenant_uid: input.tenantUid,
              project_id: input.projectId,
              integration_principal_id: HANGUP_PRINCIPAL,
              business_key_hash: businessKeyHash,
            },
            transaction,
          });
          if (!raced) throw error;
          const existingRun = await this.runs.findOne({
            where: { recording_id: raced.id },
            transaction,
          });
          if (existingRun) {
            await this.linkCdr(input, raced.id, transaction);
            return {
              jobId: existingRun.job_id,
              runId: existingRun.id,
              replay: true as const,
            };
          }
          recording = raced;
        }

      const existingRun = await this.runs.findOne({
        where: { recording_id: recording.id },
        transaction,
      });
      if (existingRun) {
        await this.linkCdr(input, recording.id, transaction);
        return {
          jobId: existingRun.job_id,
          runId: existingRun.id,
          replay: true as const,
        };
      }

      await releaseFinishedSpeechJobs(
        input.tenantUid,
        this.runs,
        this.admission,
        transaction,
      );
      const receipt = await this.admission.admit(
        {
          tenantUid: input.tenantUid,
          principalId: HANGUP_PRINCIPAL,
          product: 'speech_analytics',
          kind: 'analyze',
          resourceKind: 'project',
          resourceId: input.projectId,
          idempotencyKey: originKey,
          request: {
            recordingId: recording.id,
            assetId,
            originKey,
            recordPath: input.recordPath,
          },
          entitled: true,
          now,
        },
        transaction,
      );

      const runId = randomUUID();
      await this.runs.create(
        {
          id: runId,
          tenant_uid: input.tenantUid,
          recording_id: recording.id,
          project_version_id: project.active_version_id!,
          job_id: receipt.jobId,
          state: 'queued',
          transcript_id: null,
          result_id: null,
          parent_run_id: null,
          reason: null,
          charged: false,
          created_at: now,
          updated_at: now,
        },
        { transaction },
      );

      await this.linkCdr(input, recording.id, transaction);

      return {
        jobId: receipt.jobId,
        runId,
        replay: receipt.replay,
        recordPath: input.recordPath,
        tenantUid: input.tenantUid,
      };
    });

    // Fire-and-forget worker - never await STT on the hangup HTTP path (D-03).
    // CR-02 / D-46: pass duration (not file bytes) so Nest charge uses audio_ms correctly.
    if (!result.replay && this.worker) {
      const durationSec = Math.max(0, input.durationSec);
      void this.worker
        .processJob({
          jobId: result.jobId,
          runId: result.runId,
          recordPath: input.recordPath,
          tenantUid: input.tenantUid,
          durationSec,
          audioMs: durationSec * 1000,
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Hangup analysis worker failed job=${result.jobId}: ${message}`,
          );
        });
    }

    return { jobId: result.jobId };
  }

  private async loadKnownOrigins(
    tenantUid: number,
    projectId: string | null,
  ): Promise<Set<string>> {
    const where: Record<string, unknown> = {
      tenant_uid: tenantUid,
      integration_principal_id: HANGUP_PRINCIPAL,
      ...(projectId ? { project_id: projectId } : {}),
    };
    const rows = await this.recordings.findAll({
      where,
      attributes: ['metadata'],
      order: [['created_at', 'DESC']],
      limit: 5000,
    });
    const origins = new Set<string>();
    for (const row of rows) {
      try {
        const origin = JSON.parse(row.metadata || '{}').originKey;
        if (typeof origin === 'string' && origin.startsWith(`${tenantUid}:`))
          origins.add(origin);
      } catch {
        /* Legacy malformed metadata is not an admission identity. */
      }
    }
    return origins;
  }

  private async linkCdr(
    input: HangupAnalysisJobInput,
    recordingId: string,
    transaction: Transaction,
  ): Promise<void> {
    const nodeId = this.cdrNodeId();
    if (nodeId.length > 64)
      throw Object.assign(new Error('invalid_cdr_node'), {
        code: 'invalid_cdr_node',
        status: 400,
      });
    const where = {
      tenant_uid: input.tenantUid,
      recording_id: recordingId,
      source_kind: 'cdr',
      source_id: input.uniqueid,
    };
    const relation = await this.relations.findOne({ where, transaction });
    if (relation) {
      if (relation.node_id !== nodeId)
        throw Object.assign(new Error('call_node_mismatch'), {
          code: 'call_node_mismatch',
          status: 409,
        });
      return;
    }
    await this.relations.create(
      {
        ...where,
        id: randomUUID(),
        node_id: nodeId,
        // A webhook can refer to a child channel. Its root linkedid is not known here.
        linkedid: null,
        created_at: new Date(),
      },
      { transaction },
    );
  }
  private cdrNodeId(): string {
    // Exactly the existing DashboardReadStore namespace; do not re-key calls.
    return (
      this.config.get<string>('DASHBOARD_NODE_ID') ||
      this.config.get<string>('AMI_HOST') ||
      'local'
    );
  }
}

/** Nest token re-export for module registration clarity. */
export { HANGUP_ANALYTICS_PORT };
export type {
  HangupAnalyticsPort,
  HangupAnalysisJobInput,
  HangupAnalyticsContext,
};
