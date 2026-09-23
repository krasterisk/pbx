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
import { ModuleSettingsService } from '../module-settings.service';
import { SaAnalysisRun } from '../speech-analytics.models';
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

  const runAnalysis = async (job: SaAnalysisJob, bytes: number) => {
    const settings = deps.moduleSettings.get(job.tenantUid);
    const sttModelId = settings.sttModelId || 'default-stt';
    const scoreModelId = settings.scoreModelId || 'default-score';
    const allowlist = settings.modelAllowlist.length > 0
      ? settings.modelAllowlist
      : [sttModelId, scoreModelId];

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
      persistSuccess: async () => {
        const run = await deps.runs.findOne({
          where: { id: job.runId, tenant_uid: job.tenantUid },
        });
        if (!run) return;
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
        audioMs: Math.max(0, bytes),
        currency: 'RUB',
        channelSource: 'route',
        swapChannels: false,
        channels: 2,
        stereoVerified: true,
        moduleDefaults: { sttModelId, scoreModelId },
        publishedVersionModels: { sttModelId, scoreModelId },
        platformAllowlist: allowlist,
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
  ) => createSaAnalysisWorker({ moduleSettings, config, runs }),
  inject: [ModuleSettingsService, ConfigService, getModelToken(SaAnalysisRun)],
};
