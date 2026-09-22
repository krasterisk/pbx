/** runAnalysis — STT → diarize → score → SA-CHARGE-RUN (D-23, D-38, D-46). */

import type { SaChargeRunDeps, SaChargeRunInput, SaChargeRunResult } from '../charging/sa-charge-run';

export type AnalysisModels = {
  sttModelId: string;
  scoreModelId: string;
};

export type ChannelSource = 'route' | 'upload';

export type RunAnalysisInput = {
  runId: string;
  tenantUid: number;
  audioPath: string;
  audioMs: number;
  currency: string;
  channelSource: ChannelSource;
  swapChannels: boolean;
  channels: 1 | 2;
  stereoVerified: boolean;
  moduleDefaults: AnalysisModels;
  projectOverrides?: Partial<AnalysisModels>;
  publishedVersionModels: AnalysisModels;
  platformAllowlist: string[];
};

export type SttSegment = { start: number; end: number; text: string };

export type SttResult = {
  text: string;
  durationSec: number;
  segments: SttSegment[];
  providerTokens: number;
  modelId: string;
};

export type DiarizedSegment = {
  id: string;
  ordinal: number;
  startMs: number;
  endMs: number;
  channel: number;
  speakerRole: 'operator' | 'customer' | 'unknown';
  roleSource: 'channel_energy' | 'llm' | 'unknown';
  text: string;
};

export type DiarizeResult = {
  mode: 'energy' | 'llm_roles' | 'not_stereo';
  segments: DiarizedSegment[];
  requestSecondStt: boolean;
};

export type ScoreResult = {
  metrics: unknown[];
  summary: string;
  providerTokens: number;
  modelId: string;
};

export type RunAnalysisDeps = {
  stt: (args: { audioPath: string; modelId: string }) => Promise<SttResult | null>;
  score: (args: {
    segments: DiarizedSegment[];
    modelId: string;
  }) => Promise<ScoreResult | null>;
  diarize: (args: {
    segments: SttSegment[];
    audioPath: string;
    channels: 1 | 2;
    stereoVerified: boolean;
    channelSource: ChannelSource;
    swapChannels: boolean;
  }) => Promise<DiarizeResult>;
  persistSuccess: (patch: {
    segments: DiarizedSegment[];
    metrics: unknown[];
    summary: string;
    models: AnalysisModels;
    providerTokens: number;
  }) => Promise<void>;
  persistError: (reason: string) => Promise<void>;
  invokeSaChargeRun: (
    input: SaChargeRunInput,
    deps: SaChargeRunDeps,
  ) => Promise<SaChargeRunResult>;
  findLatestRates: SaChargeRunDeps['findLatestRates'];
  updateRunCharge: SaChargeRunDeps['updateRun'];
};

function assertAllowlisted(modelId: string, allowlist: string[], kind: string): void {
  if (!allowlist.includes(modelId)) {
    throw new Error(`Model ${kind}=${modelId} is outside the platform allowlist`);
  }
}

function pickModel(
  override: string | undefined,
  moduleDefault: string,
  allowlist: string[],
  kind: string,
): string {
  const chosen = (override && override.trim()) ? override.trim() : moduleDefault;
  assertAllowlisted(chosen, allowlist, kind);
  assertAllowlisted(moduleDefault, allowlist, kind);
  return chosen;
}

/**
 * D-38: module defaults with optional project override.
 * Empty project fields → module. Fallback for silence = module default when different.
 * No hidden model outside the platform allowlist (Phase 15 D-07 does not apply).
 */
export function resolveAnalysisModels(input: {
  moduleDefaults: AnalysisModels;
  projectOverrides?: Partial<AnalysisModels>;
  platformAllowlist: string[];
}): { primary: AnalysisModels; fallback: AnalysisModels | null } {
  const { moduleDefaults, projectOverrides = {}, platformAllowlist } = input;
  const sttPrimary = pickModel(
    projectOverrides.sttModelId,
    moduleDefaults.sttModelId,
    platformAllowlist,
    'stt',
  );
  const scorePrimary = pickModel(
    projectOverrides.scoreModelId,
    moduleDefaults.scoreModelId,
    platformAllowlist,
    'score',
  );
  const primary = { sttModelId: sttPrimary, scoreModelId: scorePrimary };
  const fallback =
    primary.sttModelId !== moduleDefaults.sttModelId
    || primary.scoreModelId !== moduleDefaults.scoreModelId
      ? { ...moduleDefaults }
      : null;
  return { primary, fallback };
}

async function sttWithFallback(
  deps: RunAnalysisDeps,
  audioPath: string,
  primary: AnalysisModels,
  fallback: AnalysisModels | null,
): Promise<{ stt: SttResult; used: AnalysisModels } | { error: string }> {
  const first = await deps.stt({ audioPath, modelId: primary.sttModelId });
  if (first) {
    return { stt: first, used: { ...primary, sttModelId: first.modelId || primary.sttModelId } };
  }
  if (fallback && fallback.sttModelId !== primary.sttModelId) {
    const second = await deps.stt({ audioPath, modelId: fallback.sttModelId });
    if (second) {
      return {
        stt: second,
        used: {
          sttModelId: second.modelId || fallback.sttModelId,
          scoreModelId: primary.scoreModelId,
        },
      };
    }
  }
  return { error: 'stt_silent' };
}

async function scoreWithFallback(
  deps: RunAnalysisDeps,
  segments: DiarizedSegment[],
  primary: AnalysisModels,
  fallback: AnalysisModels | null,
): Promise<{ score: ScoreResult; used: AnalysisModels } | { error: string }> {
  const first = await deps.score({ segments, modelId: primary.scoreModelId });
  if (first) {
    return {
      score: first,
      used: { ...primary, scoreModelId: first.modelId || primary.scoreModelId },
    };
  }
  if (fallback && fallback.scoreModelId !== primary.scoreModelId) {
    const second = await deps.score({ segments, modelId: fallback.scoreModelId });
    if (second) {
      return {
        score: second,
        used: {
          sttModelId: primary.sttModelId,
          scoreModelId: second.modelId || fallback.scoreModelId,
        },
      };
    }
  }
  return { error: 'score_silent' };
}

/**
 * One STT pass → diarize (energy or LLM roles) → score → persist → SA-CHARGE-RUN once (D-46).
 * Error paths never call the charge seam. Never imports wallet helpers.
 */
export async function runAnalysis(
  input: RunAnalysisInput,
  deps: RunAnalysisDeps,
): Promise<{ state: 'completed' | 'error'; reason?: string }> {
  let resolved: { primary: AnalysisModels; fallback: AnalysisModels | null };
  try {
    resolved = resolveAnalysisModels({
      moduleDefaults: input.moduleDefaults,
      projectOverrides: input.projectOverrides,
      platformAllowlist: input.platformAllowlist,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'model_allowlist';
    await deps.persistError(reason);
    return { state: 'error', reason };
  }

  const sttOutcome = await sttWithFallback(
    deps,
    input.audioPath,
    resolved.primary,
    resolved.fallback,
  );
  if ('error' in sttOutcome) {
    await deps.persistError(sttOutcome.error);
    return { state: 'error', reason: sttOutcome.error };
  }

  const diarized = await deps.diarize({
    segments: sttOutcome.stt.segments,
    audioPath: input.audioPath,
    channels: input.channels,
    stereoVerified: input.stereoVerified,
    channelSource: input.channelSource,
    swapChannels: input.swapChannels,
  });
  if (diarized.requestSecondStt) {
    await deps.persistError('second_stt_forbidden');
    return { state: 'error', reason: 'second_stt_forbidden' };
  }

  const modelsForScore: AnalysisModels = {
    sttModelId: sttOutcome.used.sttModelId,
    scoreModelId: resolved.primary.scoreModelId,
  };
  const scoreOutcome = await scoreWithFallback(
    deps,
    diarized.segments,
    modelsForScore,
    resolved.fallback
      ? { ...resolved.fallback, sttModelId: sttOutcome.used.sttModelId }
      : null,
  );
  if ('error' in scoreOutcome) {
    await deps.persistError(scoreOutcome.error);
    return { state: 'error', reason: scoreOutcome.error };
  }

  const providerTokens =
    (sttOutcome.stt.providerTokens || 0) + (scoreOutcome.score.providerTokens || 0);

  // Stamp published version models on the run (D-38), not the runtime fallback choice.
  await deps.persistSuccess({
    segments: diarized.segments,
    metrics: scoreOutcome.score.metrics,
    summary: scoreOutcome.score.summary,
    models: input.publishedVersionModels,
    providerTokens,
  });

  await deps.invokeSaChargeRun(
    {
      runId: input.runId,
      tenantUid: input.tenantUid,
      audioMs: input.audioMs,
      providerTokens,
      currency: input.currency,
    },
    {
      findLatestRates: deps.findLatestRates,
      updateRun: deps.updateRunCharge,
    },
  );

  return { state: 'completed' };
}
