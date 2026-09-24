/**
 * Nest binding for SaAnalysisWorker — always injects runAnalysis (G-18-02, D-03, D-23).
 * Legacy handoffPipeline remains available only for unit tests that construct the worker manually.
 */

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { readFile } from 'node:fs/promises';
import { invokeSaChargeRun } from '../charging/sa-charge-run';
import { diarizeChannels } from '../pipeline/channel-diarize';
import { runAnalysis as pipelineRunAnalysis } from '../pipeline/run-analysis';
import type { RunAnalysisDeps } from '../pipeline/run-analysis';
import { PlatformSpeechModelsService } from '../../ai-connectivity/platform-speech-models.service';
import { ModuleSettingsService } from '../module-settings.service';
import { SaAnalysisRun, SaProjectVersion, SaResult, SaTranscript, SaTranscriptSegment } from '../speech-analytics.models';
import { defaultSaProjectConfig, type SaProjectConfigV1 } from '@krasterisk/shared';
import { randomUUID } from 'node:crypto';
import {
  createDefaultWaitForFile,
  SaAnalysisWorker,
  type SaAnalysisJob,
} from './sa-analysis.worker';
import { SA_ANALYSIS_WORKER } from '../hangup-analytics.port';

export { SA_ANALYSIS_WORKER };

const nestLogger = new Logger('SaAnalysisWorkerNest');

export type SaAnalysisWorkerNestDeps = {
  moduleSettings: ModuleSettingsService;
  config: ConfigService;
  runs: typeof SaAnalysisRun;
  /** Optional STT provider — null result → runAnalysis error path (no charge). */
  stt?: RunAnalysisDeps['stt'];
  /** Optional score provider — null result → runAnalysis error path (no charge). */
  score?: RunAnalysisDeps['score'];
  findLatestRates?: RunAnalysisDeps['findLatestRates'];
  /** Platform STT/LLM ids used when the cabinet cannot edit its own models. */
  resolvePlatformModels?: () => Promise<{ sttModelId: string | null; scoreModelId: string | null }>;
  loadProjectConfig?: (job: SaAnalysisJob) => Promise<SaProjectConfigV1 | null>;
  results?: typeof SaResult;
  transcripts?: typeof SaTranscript;
  segments?: typeof SaTranscriptSegment;
};

/**
 * Build a production SaAnalysisWorker with mandatory runAnalysis.
 * handoffPipeline is intentionally omitted so Nest DI never falls through to legacy.
 */
export function createSaAnalysisWorker(deps: SaAnalysisWorkerNestDeps): SaAnalysisWorker {
  const recordsBase = deps.config.get<string>('RECORDS_PATH')
    || deps.config.get<string>('RECORDS_BASE')
    || '/usr/records';

  const waitForFile = createDefaultWaitForFile(recordsBase);

  const stt: RunAnalysisDeps['stt'] = deps.stt
    ?? (async () => {
      nestLogger.warn('STT provider not configured — analysis cannot score');
      return null;
    });

  const score: RunAnalysisDeps['score'] = deps.score
    ?? (async () => {
      nestLogger.warn('Score provider not configured — analysis cannot score');
      return null;
    });

  const findLatestRates: RunAnalysisDeps['findLatestRates'] = deps.findLatestRates
    ?? (async () => []);

  const updateRunCharge: RunAnalysisDeps['updateRunCharge'] = async (runId, tenantUid, patch) => {
    const run = await deps.runs.findOne({ where: { id: runId, tenant_uid: tenantUid } });
    if (!run) return;
    run.amount = patch.amount;
    run.currency = patch.currency;
    run.audio_ms = patch.audio_ms;
    run.provider_tokens = patch.provider_tokens;
    run.charged = patch.charged;
    run.updated_at = new Date();
    await run.save();
  };

  const runAnalysis = async (job: SaAnalysisJob, _bytes: number) => {
    // CR-02 / D-46: audioMs is duration, never waitForFile byte size (_bytes is diagnostics only).
    const fromAudioMs = typeof job.audioMs === 'number' && Number.isFinite(job.audioMs)
      ? Math.max(0, job.audioMs)
      : null;
    const fromDurationSec = typeof job.durationSec === 'number' && Number.isFinite(job.durationSec)
      ? Math.max(0, job.durationSec) * 1000
      : null;
    const audioMs = fromAudioMs ?? fromDurationSec ?? 0;

    const settings = deps.moduleSettings.get(job.tenantUid);
    const platform = deps.resolvePlatformModels
      ? await deps.resolvePlatformModels()
      : { sttModelId: null, scoreModelId: null };
    const ownStt = settings.cabinetCanEditModels ? settings.sttModelId : null;
    const ownScore = settings.cabinetCanEditModels ? settings.scoreModelId : null;
    const sttModelId = ownStt || platform.sttModelId || settings.sttModelId || 'default-stt';
    const scoreModelId = ownScore || platform.scoreModelId || settings.scoreModelId || 'default-score';
    const baseAllowlist = settings.modelAllowlist.length > 0
      ? settings.modelAllowlist
      : [sttModelId, scoreModelId];
    const allowlist = Array.from(new Set([
      ...baseAllowlist,
      ...(platform.sttModelId ? [platform.sttModelId] : []),
      ...(platform.scoreModelId ? [platform.scoreModelId] : []),
    ]));

    const absolute = job.recordPath.endsWith('.mp3')
      ? (job.recordPath.startsWith('/') ? job.recordPath : `${recordsBase}/${job.recordPath}`)
      : `${recordsBase}/${job.recordPath}.mp3`;

    let stereoWav: Buffer | null = null;
    try {
      stereoWav = await readFile(absolute);
    } catch {
      stereoWav = null;
    }

    const pipelineDeps: RunAnalysisDeps = {
      stt,
      score,
      diarize: async (args) => diarizeChannels({
        segments: args.segments,
        stereoWav,
        channels: args.channels,
        stereoVerified: args.stereoVerified,
        channelSource: args.channelSource,
        swapChannels: args.swapChannels,
      }),
      persistSuccess: async (patch) => {
        const run = await deps.runs.findOne({
          where: { id: job.runId, tenant_uid: job.tenantUid },
        });
        if (!run) return;
        if (deps.transcripts && deps.segments && patch.segments.length) {
          const transcriptId = randomUUID();
          await deps.transcripts.create({
            id: transcriptId,
            tenant_uid: job.tenantUid,
            asset_id: run.recording_id,
            stt_revision_id: patch.models.sttModelId || 'stt',
            content_digest: transcriptId,
            coverage: 'full',
            created_at: new Date(),
          });
          await Promise.all(patch.segments.map((segment) => deps.segments!.create({
            id: randomUUID(),
            tenant_uid: job.tenantUid,
            transcript_id: transcriptId,
            ordinal: segment.ordinal,
            start_ms: String(segment.startMs),
            end_ms: String(segment.endMs),
            channel: segment.channel,
            speaker_role: segment.speakerRole,
            role_source: segment.roleSource,
            text: segment.text,
            confidence: null,
          })));
          run.transcript_id = transcriptId;
        }
        if (deps.results) {
          const resultId = randomUUID();
          await deps.results.create({
            id: resultId,
            tenant_uid: job.tenantUid,
            run_id: run.id,
            version: 1,
            schema_version: 1,
            summary: patch.summary || '',
            metric_results: JSON.stringify(patch.metrics ?? []),
            evidence_refs: '[]',
            quality: 'ok',
            status: 'scored',
            created_at: new Date(),
          });
          run.result_id = resultId;
        }
        run.state = 'completed';
        run.updated_at = new Date();
        await run.save();
      },
      persistError: async (reason: string) => {
        const run = await deps.runs.findOne({
          where: { id: job.runId, tenant_uid: job.tenantUid },
        });
        if (!run) return;
        run.state = 'error';
        run.reason = reason.slice(0, 64);
        run.updated_at = new Date();
        await run.save();
      },
      invokeSaChargeRun,
      findLatestRates,
      updateRunCharge,
    };

    const outcome = await pipelineRunAnalysis(
      {
        runId: job.runId,
        tenantUid: job.tenantUid,
        audioPath: absolute,
        audioMs,
        currency: 'RUB',
        channelSource: 'route',
        swapChannels: false,
        channels: 2,
        stereoVerified: true,
        moduleDefaults: { sttModelId, scoreModelId },
        publishedVersionModels: { sttModelId, scoreModelId },
        platformAllowlist: allowlist,
        projectConfig: deps.loadProjectConfig
          ? await deps.loadProjectConfig(job)
          : defaultSaProjectConfig(),
      },
      pipelineDeps,
    );

    return {
      state: outcome.state,
      scored: outcome.state === 'completed',
      reason: outcome.reason,
    };
  };

  return new SaAnalysisWorker({
    waitForFile,
    // Kept for wait-failure contract; worker never calls it when wait fails.
    invokeSaChargeRun: async (...args: unknown[]) => invokeSaChargeRun(
      args[0] as Parameters<typeof invokeSaChargeRun>[0],
      args[1] as Parameters<typeof invokeSaChargeRun>[1],
    ),
    runAnalysis,
    // handoffPipeline intentionally omitted — Nest production path must use runAnalysis.
  });
}

/** Nest factory provider for SpeechAnalyticsModule. */
export const saAnalysisWorkerProvider = {
  provide: SA_ANALYSIS_WORKER,
  useFactory: (
    moduleSettings: ModuleSettingsService,
    config: ConfigService,
    runs: typeof SaAnalysisRun,
    platformModels: PlatformSpeechModelsService,
    versions: typeof SaProjectVersion,
    results: typeof SaResult,
    transcripts: typeof SaTranscript,
    segments: typeof SaTranscriptSegment,
  ) => createSaAnalysisWorker({
    moduleSettings,
    config,
    runs,
    results,
    transcripts,
    segments,
    loadProjectConfig: async (job) => {
      const run = await runs.findOne({ where: { id: job.runId, tenant_uid: job.tenantUid } });
      if (!run?.project_version_id) return defaultSaProjectConfig();
      const version = await versions.findOne({
        where: { id: run.project_version_id, tenant_uid: job.tenantUid },
      });
      if (!version?.config) return defaultSaProjectConfig();
      try {
        return { ...defaultSaProjectConfig(), ...JSON.parse(version.config) as SaProjectConfigV1 };
      } catch {
        return defaultSaProjectConfig();
      }
    },
    resolvePlatformModels: () => platformModels.modelIds().catch(() => ({
      sttModelId: null,
      scoreModelId: null,
    })),
  }),
  inject: [
    ModuleSettingsService,
    ConfigService,
    getModelToken(SaAnalysisRun),
    PlatformSpeechModelsService,
    getModelToken(SaProjectVersion),
    getModelToken(SaResult),
    getModelToken(SaTranscript),
    getModelToken(SaTranscriptSegment),
  ],
};
