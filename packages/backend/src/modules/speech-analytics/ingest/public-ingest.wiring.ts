/**
 * Public API ingest wiring (G-18-03 / CR-01).
 * allocateUpload → putUploadContent → completeUpload → createRun → runAnalysis.
 * Success ids are sa_* recording UUIDs — never journal: / journal-url: stubs.
 */

import { randomUUID } from 'node:crypto';
import type { TenantContext } from '../../integration-credentials/tenant-context';
import type { UploadServiceDeps } from './upload.service';
import type { UrlIngestDeps } from './url-download';
import {
  runAnalysis as runAnalysisPipeline,
  type RunAnalysisDeps,
  type RunAnalysisInput,
} from '../pipeline/run-analysis';
import { diarizeChannels } from '../pipeline/channel-diarize';
import { invokeSaChargeRun } from '../charging/sa-charge-run';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidRecordingId(id: string): boolean {
  return UUID_RE.test(id);
}

export type PublicIngestAnalytics = {
  allocateUpload: (
    context: TenantContext,
    projectId: string,
    expectedBytes?: number,
  ) => Promise<{ id: string; expiresAt: string }>;
  putUploadContent: (
    context: TenantContext,
    uploadId: string,
    body: Buffer,
  ) => Promise<{ receivedBytes: number }>;
  completeUpload: (
    context: TenantContext,
    uploadId: string,
    checksum?: string,
  ) => Promise<{ status: number; assetId: string; state: string }>;
  createRun: (
    context: TenantContext,
    input: {
      projectId: string;
      assetId: string;
      externalCallId?: string;
      sourcePart?: string;
      metadata?: Record<string, unknown>;
      idempotencyKey: string;
    },
  ) => Promise<{
    status: number;
    runId: string;
    recordingId: string;
    projectVersionId: string | null;
    replay: boolean;
  }>;
};

export type PublicScoredAnalysisArgs = {
  runId: string;
  recordingId: string;
  bytes: Buffer;
  swapChannels?: boolean;
  tenantUid: number;
};

export type BuildPublicIngestDepsInput = {
  analytics: PublicIngestAnalytics;
  context: TenantContext;
  projectId: string;
  /**
   * Scored orchestration bound to the createRun result.
   * Defaults to pipeline/run-analysis (charged=false via SA-CHARGE-RUN; no wallet).
   */
  runScoredAnalysis?: (args: PublicScoredAnalysisArgs) => Promise<{ summary: string }>;
  pipelineDeps?: Partial<RunAnalysisDeps>;
  pipelineInputDefaults?: Partial<RunAnalysisInput>;
};

type JournalMeta = {
  projectId: string;
  sourceKind: 'upload' | 'url';
  filename?: string;
  operator?: { userId?: number; name?: string };
  clientPhone?: string | null;
  language?: string | null;
  consent?: string | null;
};

/** Unique keys so two identical uploads still create two sa_* conversations. */
export function uniquePublicIngestKeys(): {
  idempotencyKey: string;
  externalCallId: string;
} {
  return {
    idempotencyKey: randomUUID(),
    externalCallId: randomUUID(),
  };
}

const DEFAULT_ALLOWLIST = ['stt-default', 'score-default'];

function defaultPipelineDeps(
  overrides: Partial<RunAnalysisDeps> = {},
): RunAnalysisDeps {
  return {
    stt: async () => null,
    score: async () => null,
    diarize: async ({
      segments,
      channels,
      stereoVerified,
      channelSource,
      swapChannels,
    }) => diarizeChannels({
      segments,
      stereoWav: null,
      channels,
      stereoVerified,
      channelSource,
      swapChannels,
    }),
    persistSuccess: async () => undefined,
    persistError: async () => undefined,
    invokeSaChargeRun,
    findLatestRates: async () => [],
    updateRunCharge: async () => undefined,
    ...overrides,
  };
}

/**
 * Default scored path: real pipeline/run-analysis (D-23/D-46).
 * Charge persists charged=false via invokeSaChargeRun; never wallet debit.
 */
export async function defaultPublicScoredAnalysis(
  args: PublicScoredAnalysisArgs,
  opts: {
    pipelineDeps?: Partial<RunAnalysisDeps>;
    pipelineInputDefaults?: Partial<RunAnalysisInput>;
  } = {},
): Promise<{ summary: string }> {
  let summary = `run:${args.runId}`;
  const deps = defaultPipelineDeps({
    ...opts.pipelineDeps,
    persistSuccess: async (patch) => {
      summary = patch.summary || summary;
      await opts.pipelineDeps?.persistSuccess?.(patch);
    },
  });

  const input: RunAnalysisInput = {
    runId: args.runId,
    tenantUid: args.tenantUid,
    audioPath: `memory://sa/${args.recordingId}`,
    audioMs: Math.max(1_000, Math.round(args.bytes.length / 16)),
    currency: 'RUB',
    channelSource: 'upload',
    swapChannels: args.swapChannels === true,
    channels: 1,
    stereoVerified: false,
    moduleDefaults: { sttModelId: 'stt-default', scoreModelId: 'score-default' },
    publishedVersionModels: { sttModelId: 'stt-default', scoreModelId: 'score-default' },
    platformAllowlist: DEFAULT_ALLOWLIST,
    ...opts.pipelineInputDefaults,
  };

  const outcome = await runAnalysisPipeline(input, deps);
  if (outcome.state !== 'completed') {
    throw new Error(outcome.reason ?? 'analyze_failed');
  }
  return { summary };
}

function buildSharedIngestHandlers(input: BuildPublicIngestDepsInput): {
  putUploadContent: (bytes: Buffer) => Promise<{ storedBytes: number }>;
  createJournalFromMeta: (row: JournalMeta) => Promise<{ id: string; createsCdr: false }>;
  runAnalysis: UploadServiceDeps['runAnalysis'];
} {
  let pendingAssetId = '';
  const runByRecording = new Map<string, string>();

  const scored =
    input.runScoredAnalysis
    ?? ((args: PublicScoredAnalysisArgs) => defaultPublicScoredAnalysis(args, {
      pipelineDeps: input.pipelineDeps,
      pipelineInputDefaults: input.pipelineInputDefaults,
    }));

  return {
    putUploadContent: async (bytes) => {
      const allocated = await input.analytics.allocateUpload(
        input.context,
        input.projectId,
        bytes.length,
      );
      await input.analytics.putUploadContent(input.context, allocated.id, bytes);
      const completed = await input.analytics.completeUpload(
        input.context,
        allocated.id,
      );
      pendingAssetId = completed.assetId;
      return { storedBytes: bytes.length };
    },

    createJournalFromMeta: async (row) => {
      if (!pendingAssetId) {
        throw Object.assign(new Error('asset_missing'), { code: 'asset_missing' });
      }
      const keys = uniquePublicIngestKeys();
      const created = await input.analytics.createRun(input.context, {
        projectId: row.projectId,
        assetId: pendingAssetId,
        externalCallId: keys.externalCallId,
        idempotencyKey: keys.idempotencyKey,
        metadata: {
          source: row.sourceKind,
          filename: row.filename,
          operator: row.operator,
          clientPhone: row.clientPhone,
          language: row.language,
          consent: row.consent,
        },
      });
      runByRecording.set(created.recordingId, created.runId);
      pendingAssetId = '';
      return { id: created.recordingId, createsCdr: false as const };
    },

    runAnalysis: async ({ journalId, bytes, swapChannels }) => {
      const runId = runByRecording.get(journalId);
      if (!runId) {
        throw Object.assign(new Error('run_binding_missing'), {
          code: 'run_binding_missing',
        });
      }
      return scored({
        runId,
        recordingId: journalId,
        bytes,
        swapChannels,
        tenantUid: input.context.tenantUid,
      });
    },
  };
}

/** UploadService deps: real sa_* createRun + scored orchestration. */
export function buildPublicUploadDeps(
  input: BuildPublicIngestDepsInput,
): UploadServiceDeps {
  const shared = buildSharedIngestHandlers(input);
  return {
    putUploadContent: shared.putUploadContent,
    createJournalRow: async (row) => shared.createJournalFromMeta({
      projectId: row.projectId,
      sourceKind: 'upload',
      filename: row.filename,
      operator: row.operator,
      clientPhone: row.clientPhone,
      language: row.language,
    }),
    runAnalysis: shared.runAnalysis,
  };
}

/** UrlIngestService deps: same sa_* path (D-39…D-42). */
export function buildPublicUrlDeps(
  input: BuildPublicIngestDepsInput,
): Pick<UrlIngestDeps, 'putUploadContent' | 'createJournalRow' | 'runAnalysis'> {
  const shared = buildSharedIngestHandlers(input);
  return {
    putUploadContent: shared.putUploadContent,
    createJournalRow: async (row) => {
      const journal = await shared.createJournalFromMeta({
        projectId: row.projectId,
        sourceKind: 'url',
        consent: row.consent,
      });
      return { id: journal.id };
    },
    runAnalysis: async ({ journalId, bytes }) => shared.runAnalysis({
      journalId,
      bytes,
      swapChannels: false,
    }),
  };
}
