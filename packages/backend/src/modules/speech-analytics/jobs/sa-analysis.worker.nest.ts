/**
 * Nest binding for SaAnalysisWorker - always injects runAnalysis (G-18-02, D-03, D-23).
 * Legacy handoffPipeline remains available only for unit tests that construct the worker manually.
 */

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { readFile } from 'node:fs/promises';
import { invokeSaChargeRun } from '../charging/sa-charge-run';
import { configForAnalysis } from '../pipeline/analysis-prompt';
import { diarizeChannels } from '../pipeline/channel-diarize';
import { decodeToPcmWav, isPcmWav } from '../pipeline/decode-pcm-wav';
import { runAnalysis as pipelineRunAnalysis } from '../pipeline/run-analysis';
import type { RunAnalysisDeps } from '../pipeline/run-analysis';
import { PlatformSpeechModelsService } from '../../ai-connectivity/platform-speech-models.service';
import { SpeechProviderResolver } from '../speech-provider.resolver';
import { ModuleSettingsService } from '../module-settings.service';
import { SaAnalysisRun, SaProjectVersion, SaRecording, SaResult, SaTranscript, SaTranscriptSegment } from '../speech-analytics.models';
import { type SaProjectConfigV1 } from '@krasterisk/shared';
import { randomUUID } from 'node:crypto';
import { AiProvidersService } from '../../ai-connectivity/ai-providers.service';
import { decryptSecret } from '../../ai-connectivity/secret-cipher.util';
import {
  labelProviderSpeakers,
  readAudioFile,
  scoreProviderTranscript,
  transcribeProviderAudio,
} from '../pipeline/provider-analysis';
import {
  createDefaultWaitForFile,
  resolveAnalysisAudioPath,
  SaAnalysisWorker,
  type SaAnalysisJob,
} from './sa-analysis.worker';
import { SA_ANALYSIS_WORKER } from '../hangup-analytics.port';
import { AiJobAdmissionService } from '../../ai-jobs/ai-job-admission.service';

export { SA_ANALYSIS_WORKER };

const nestLogger = new Logger('SaAnalysisWorkerNest');

export type SaAnalysisWorkerNestDeps = {
  moduleSettings: ModuleSettingsService;
  config: ConfigService;
  runs: typeof SaAnalysisRun;
  /** Optional STT provider - null result → runAnalysis error path (no charge). */
  stt?: RunAnalysisDeps['stt'];
  /** Optional score provider - null result → runAnalysis error path (no charge). */
  score?: RunAnalysisDeps['score'];
  findLatestRates?: RunAnalysisDeps['findLatestRates'];
  /** Platform STT/LLM ids used when the cabinet cannot edit its own models. */
  resolvePlatformModels?: () => Promise<{ sttModelId: string | null; scoreModelId: string | null }>;
  loadProjectConfig?: (job: SaAnalysisJob) => Promise<SaProjectConfigV1 | null>;
  /** Platform STT/LLM catalog. When set, the default providers call those engines. */
  providers?: AiProvidersService;
  platformModels?: PlatformSpeechModelsService;
  speechProviders?: SpeechProviderResolver;
  results?: typeof SaResult;
  transcripts?: typeof SaTranscript;
  segments?: typeof SaTranscriptSegment;
  recordings?: typeof SaRecording;
  /** Closes the fairness slot when the in-process analysis finishes. */
  settleAdmission?: (tenantUid: number, jobId: string, outcome: 'succeeded' | 'failed') => Promise<void>;
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
    ?? (async ({ audioPath, modelId }) => {
      if (!deps.providers || !deps.platformModels) {
        nestLogger.warn('STT provider not configured - analysis cannot score');
        return null;
      }
      const assignment = await deps.platformModels.get();
      if (!assignment.sttProviderUid) {
        nestLogger.warn('Speech analytics STT provider is not assigned');
        return null;
      }
      try {
        const engine = await deps.providers.loadSpeechEngine(0, assignment.sttProviderUid, 'stt');
        const audio = await readAudioFile(resolveAnalysisAudioPath(audioPath, recordsBase));
        return await transcribeProviderAudio(engine, audio, 'audio.bin', modelId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        nestLogger.warn(`STT failed: ${message}`);
        return null;
      }
    });

  const score: RunAnalysisDeps['score'] = deps.score
    ?? (async ({ segments, modelId, projectConfig, transcript }) => {
      if (!deps.providers || !deps.platformModels) {
        nestLogger.warn('Score provider not configured - analysis cannot score');
        return null;
      }
      const assignment = await deps.platformModels.get();
      if (!assignment.llmProviderUid) {
        nestLogger.warn('Speech analytics LLM provider is not assigned');
        return null;
      }
      const rows = await deps.providers.findGlobal('llm');
      const provider = rows.find((row) => row.uid === assignment.llmProviderUid);
      if (!provider) return null;
      try {
        const token = provider.encrypted_api_key ? decryptSecret(provider.encrypted_api_key) : '';
        return await scoreProviderTranscript({
          provider,
          token,
          segments,
          transcript,
          projectConfig,
          modelId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        nestLogger.warn(`Score failed: ${message}`);
        return null;
      }
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

    const queued = await deps.runs.findOne({
      where: { id: job.runId, tenant_uid: job.tenantUid },
    });
    if (queued && queued.state === 'queued') {
      queued.state = 'running';
      queued.updated_at = new Date();
      await queued.save();
    }

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

    const absolute = resolveAnalysisAudioPath(job.recordPath, recordsBase);
    const channelSource = job.channelSource ?? 'route';
    const projectConfig = deps.loadProjectConfig
      ? await deps.loadProjectConfig(job)
      : configForAnalysis(null);
    const resolved = deps.speechProviders
      ? await deps.speechProviders.resolve(job.tenantUid, projectConfig)
      : null;
    const llmAuth = async () => {
      const uid = resolved?.llmProviderUid ?? null;
      if (!deps.providers || !uid) return null;
      const own = await deps.providers.findAll(job.tenantUid, 'llm');
      const global = await deps.providers.findGlobal('llm');
      const provider = [...own, ...global].find((row) => row.uid === uid);
      if (!provider) return null;
      let token = '';
      try {
        const blob = provider.encrypted_api_key?.trim() ?? '';
        token = blob ? decryptSecret(blob) : '';
      } catch {
        return null;
      }
      const model = typeof provider.defaults?.model === 'string' && provider.defaults.model.trim()
        ? provider.defaults.model.trim()
        : scoreModelId;
      return { provider, token, model };
    };
    const jobStt: RunAnalysisDeps['stt'] = deps.stt ?? (async ({ audioPath, modelId }) => {
      const uid = resolved?.sttProviderUid ?? null;
      if (!deps.providers || !uid) {
        nestLogger.warn('Speech analytics STT provider is not assigned');
        return null;
      }
      let named = modelId;
      try {
        const engine = await deps.providers.loadSpeechEngine(job.tenantUid, uid, 'stt');
        const fromEngine = typeof engine.settings?.model === 'string' ? engine.settings.model.trim() : '';
        named = fromEngine || modelId || 'whisper-1';
        const audio = await readAudioFile(resolveAnalysisAudioPath(audioPath, recordsBase));
        return await transcribeProviderAudio(engine, audio, 'audio.bin', named);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        nestLogger.warn(`STT failed provider=${uid} model=${named}: ${message}`);
        return null;
      }
    });
    const jobScore: RunAnalysisDeps['score'] = deps.score ?? (async ({ segments, modelId, projectConfig: config, transcript }) => {
      const uid = resolved?.llmProviderUid ?? null;
      if (!deps.providers || !uid) {
        nestLogger.warn('Speech analytics LLM provider is not assigned');
        return null;
      }
      const own = await deps.providers.findAll(job.tenantUid, 'llm');
      const global = await deps.providers.findGlobal('llm');
      const provider = [...own, ...global].find((row) => row.uid === uid);
      if (!provider) {
        nestLogger.warn(`Score provider ${uid} was not found among tenant or global LLM connections`);
        return null;
      }
      const model = typeof provider.defaults?.model === 'string' && provider.defaults.model.trim()
        ? provider.defaults.model.trim()
        : modelId;
      let token = '';
      try {
        const blob = provider.encrypted_api_key?.trim() ?? '';
        token = blob ? decryptSecret(blob) : '';
      } catch (error) {
        const blob = provider.encrypted_api_key?.trim() ?? '';
        const envelope = blob.startsWith('v2:') ? blob.split(':').slice(0, 2).join(':') : 'legacy';
        const message = error instanceof Error ? error.message : String(error);
        nestLogger.warn(
          `Score provider=${provider.uid} name=${provider.name} endpoint=${provider.endpoint} auth=${provider.auth_type} key=${envelope} cannot be decrypted (${message}). Save the API key again in Global models.`,
        );
        return null;
      }
      nestLogger.log(
        `Score provider=${provider.uid} name=${provider.name} model=${model} auth=${provider.auth_type} endpoint=${provider.endpoint}`,
      );
      try {
        return await scoreProviderTranscript({
          provider,
          token,
          segments,
          transcript,
          projectConfig: config,
          modelId: model,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        nestLogger.warn(`Score failed provider=${provider.uid} name=${provider.name} endpoint=${provider.endpoint}: ${message}`);
        return null;
      }
    });

    let stereoWav: Buffer | null = null;
    try {
      stereoWav = await readFile(absolute);
    } catch {
      stereoWav = null;
    }

    const closeAdmission = async (jobId: string | null, outcome: 'succeeded' | 'failed') => {
      if (!jobId || !deps.settleAdmission) return;
      try {
        await deps.settleAdmission(job.tenantUid, jobId, outcome);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        nestLogger.warn(`Could not close analysis job ${jobId}: ${message}`);
      }
    };

    const pipelineDeps: RunAnalysisDeps = {
      stt: jobStt,
      score: jobScore,
      diarize: async (args) => {
        let wav = stereoWav;
        if (wav && !isPcmWav(wav)) {
          wav = await decodeToPcmWav(absolute);
        }
        const labeled = diarizeChannels({
          segments: args.segments,
          stereoWav: wav,
          channels: args.channels,
          stereoVerified: args.stereoVerified && Boolean(wav && isPcmWav(wav)),
          channelSource: args.channelSource,
          swapChannels: args.swapChannels,
        });
        const unlabeled = labeled.segments.length > 0
          && labeled.segments.every((segment) => segment.speakerRole === 'unknown');
        if (!unlabeled) return labeled;
        const auth = await llmAuth();
        if (!auth) return labeled;
        const roles = await labelProviderSpeakers({
          provider: auth.provider,
          token: auth.token,
          modelId: auth.model,
          segments: labeled.segments,
        });
        if (!roles) return labeled;
        return {
          ...labeled,
          mode: 'llm_roles',
          segments: labeled.segments.map((segment, index) => {
            const role = roles[index];
            if (role !== 'operator' && role !== 'customer') return segment;
            return {
              ...segment,
              speakerRole: role,
              roleSource: 'llm' as const,
              channel: role === 'operator' ? 0 : 1,
            };
          }),
        };
      },
      persistSuccess: async (patch) => {
        const run = await deps.runs.findOne({
          where: { id: job.runId, tenant_uid: job.tenantUid },
        });
        if (!run) return;
        const recording = deps.recordings
          ? await deps.recordings.findOne({
            where: { id: run.recording_id, tenant_uid: job.tenantUid },
          })
          : null;
        const assetId = recording?.asset_id;
        if (!assetId && patch.segments.length) {
          nestLogger.warn(`Transcript not stored: recording ${run.recording_id} has no media asset`);
        }
        if (deps.transcripts && deps.segments && patch.segments.length && assetId) {
          const transcriptId = randomUUID();
          await deps.transcripts.create({
            id: transcriptId,
            tenant_uid: job.tenantUid,
            asset_id: assetId,
            stt_revision_id: (patch.models.sttModelId || 'stt').slice(0, 36),
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
            status: 'completed',
            created_at: new Date(),
          });
          run.result_id = resultId;
        }
        run.state = 'completed';
        run.updated_at = new Date();
        await run.save();
        await closeAdmission(run.job_id, 'succeeded');
      },
      persistError: async (reason: string) => {
        const run = await deps.runs.findOne({
          where: { id: job.runId, tenant_uid: job.tenantUid },
        });
        if (!run) return;
        run.state = 'failed';
        run.reason = reason.slice(0, 64);
        run.updated_at = new Date();
        await run.save();
        await closeAdmission(run.job_id, 'failed');
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
        channelSource,
        swapChannels: false,
        channels: 2,
        stereoVerified: true,
        moduleDefaults: { sttModelId, scoreModelId },
        publishedVersionModels: { sttModelId, scoreModelId },
        platformAllowlist: allowlist,
        projectConfig,
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
    // handoffPipeline intentionally omitted - Nest production path must use runAnalysis.
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
    providers: AiProvidersService,
    versions: typeof SaProjectVersion,
    results: typeof SaResult,
    transcripts: typeof SaTranscript,
    segments: typeof SaTranscriptSegment,
    speechProviders: SpeechProviderResolver,
    recordings: typeof SaRecording,
    admission: AiJobAdmissionService,
  ) => createSaAnalysisWorker({
    moduleSettings,
    config,
    runs,
    results,
    transcripts,
    segments,
    recordings,
    loadProjectConfig: async (job) => {
      const run = await runs.findOne({ where: { id: job.runId, tenant_uid: job.tenantUid } });
      if (!run?.project_version_id) return configForAnalysis(null);
      const version = await versions.findOne({
        where: { id: run.project_version_id, tenant_uid: job.tenantUid },
      });
      if (!version?.config) return configForAnalysis(null);
      try {
        return configForAnalysis(JSON.parse(version.config) as SaProjectConfigV1);
      } catch {
        return configForAnalysis(null);
      }
    },
    resolvePlatformModels: () => platformModels.modelIds().catch(() => ({
      sttModelId: null,
      scoreModelId: null,
    })),
    providers,
    platformModels,
    speechProviders,
    settleAdmission: (tenantUid, jobId, outcome) => admission.settle(tenantUid, jobId, outcome),
  }),
  inject: [
    ModuleSettingsService,
    ConfigService,
    getModelToken(SaAnalysisRun),
    PlatformSpeechModelsService,
    AiProvidersService,
    getModelToken(SaProjectVersion),
    getModelToken(SaResult),
    getModelToken(SaTranscript),
    getModelToken(SaTranscriptSegment),
    SpeechProviderResolver,
    getModelToken(SaRecording),
    AiJobAdmissionService,
  ],
};
