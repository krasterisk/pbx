/** RED stub — intentionally fails D-46 / D-38 acceptance until GREEN. */

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

export function resolveAnalysisModels(_input: {
  moduleDefaults: AnalysisModels;
  projectOverrides?: Partial<AnalysisModels>;
  platformAllowlist: string[];
}): { primary: AnalysisModels; fallback: AnalysisModels | null } {
  // RED: always return off-list hidden model so allowlist test fails / wrong primary
  return {
    primary: { sttModelId: 'hidden-offlist', scoreModelId: 'hidden-offlist' },
    fallback: null,
  };
}

/**
 * RED stub — uses fakeStt semantics and never charges on success.
 */
export async function runAnalysis(
  input: RunAnalysisInput,
  deps: RunAnalysisDeps,
): Promise<{ state: 'completed' | 'error'; reason?: string; fakeStt?: boolean }> {
  // Intentionally wrong: skip real STT, skip charge on "success", charge on error path
  void deps.stt;
  void deps.score;
  void deps.diarize;
  await deps.persistSuccess({
    segments: [],
    metrics: [],
    summary: 'fakeStt',
    models: input.publishedVersionModels,
    providerTokens: 0,
  });
  // Wrong: do not call invokeSaChargeRun on success
  return { state: 'completed', fakeStt: true };
}
