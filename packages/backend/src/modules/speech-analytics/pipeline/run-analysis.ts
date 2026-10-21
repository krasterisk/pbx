/** runAnalysis - STT → diarize → score → SA-CHARGE-RUN (D-23, D-38, D-46). */

import { saTextPrivacyEnabled, type SaProjectConfigV1 } from '@krasterisk/shared';
import type { SaChargeRunDeps, SaChargeRunInput, SaChargeRunResult } from '../charging/sa-charge-run';
import { boundSttToMedia } from './media-timing';
import { alignTranscriptPrivacyEvidence } from './text-privacy';

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
  /** Duration measured from decoded media, never a CDR billing duration. */
  verifiedMediaDurationMs?: number;
  currency: string;
  channelSource: ChannelSource;
  swapChannels: boolean;
  channels: 1 | 2;
  stereoVerified: boolean;
  moduleDefaults: AnalysisModels;
  projectOverrides?: Partial<AnalysisModels>;
  publishedVersionModels: AnalysisModels;
  platformAllowlist: string[];
  /** Published project. Scoring uses its metrics, prompt, and topics. */
  projectConfig?: SaProjectConfigV1 | null;
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
  prepareText?: (segments: SttSegment[], config: SaProjectConfigV1) => Promise<{texts:string[];config:SaProjectConfigV1;receipt:unknown}>;
  stt: (args: { audioPath: string; modelId: string }) => Promise<SttResult | null>;
  score: (args: {
    segments: DiarizedSegment[];
    modelId: string;
    projectConfig?: SaProjectConfigV1 | null;
    transcript?: string;
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
    evidence?: unknown[];
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
  projectConfig: SaProjectConfigV1 | null,
): Promise<{ score: ScoreResult; used: AnalysisModels } | { error: string }> {
  const transcript = segments.map((s) => `${s.speakerRole}: ${s.text}`).join('\n');
  const first = await deps.score({
    segments,
    modelId: primary.scoreModelId,
    projectConfig,
    transcript,
  });
  if (first) {
    return {
      score: first,
      used: { ...primary, scoreModelId: first.modelId || primary.scoreModelId },
    };
  }
  if (fallback && fallback.scoreModelId !== primary.scoreModelId) {
    const second = await deps.score({
      segments,
      modelId: fallback.scoreModelId,
      projectConfig,
      transcript,
    });
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

  let bounded: ReturnType<typeof boundSttToMedia>;
  try { bounded=boundSttToMedia(sttOutcome.stt.segments,input.verifiedMediaDurationMs); }
  catch (error) {const reason=error instanceof Error?error.message:'invalid_stt_timing';await deps.persistError(reason);return{state:'error',reason};}
  let cloudSegments=bounded.segments;
  let cloudConfig=input.projectConfig ?? null;
  const evidence:unknown[]=[...bounded.evidence];
  try {
    if(saTextPrivacyEnabled(cloudConfig)) {
      if(!deps.prepareText || !cloudConfig) throw new Error('text_privacy_local_unavailable');
      const prepared=await deps.prepareText(bounded.segments,cloudConfig);
      if(prepared.texts.length!==bounded.segments.length || prepared.texts.some(s=>typeof s!=='string' || !s.trim())) throw new Error('text_privacy_invalid_response');
      cloudSegments=bounded.segments.map((s,i)=>({...s,text:prepared.texts[i]}));
      cloudConfig=prepared.config; evidence.push(prepared.receipt);
    }
  } catch {
    await deps.persistError('text_privacy_failed');
    return {state:'error',reason:'text_privacy_failed'};
  }
  const diarized = await deps.diarize({
    segments: cloudSegments,
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
    cloudConfig,
  );
  if ('error' in scoreOutcome) {
    await deps.persistError(scoreOutcome.error);
    return { state: 'error', reason: scoreOutcome.error };
  }

  const providerTokens =
    (sttOutcome.stt.providerTokens || 0) + (scoreOutcome.score.providerTokens || 0);

  // Stamp published version models on the run (D-38), not the runtime fallback choice.
  let persistedSegments=diarized.segments;
  if(saTextPrivacyEnabled(input.projectConfig)) {
    // Energy diarization coalesces adjacent turns. Align consecutive source text,
    // not array indexes, so originals and timestamps survive that transformation.
    const norm=(s:string)=>s.normalize('NFKC').replace(/\s+/gu,' ').trim();
    let cursor=0;
    try {
      persistedSegments=diarized.segments.map(segment=>{
        const from=cursor;let combined='';
        while(cursor<cloudSegments.length && norm(combined)!==norm(segment.text)) {
          combined+=(combined?' ':'')+cloudSegments[cursor++].text;
          if(norm(combined).length>norm(segment.text).length) break;
        }
        if(cursor===from || norm(combined)!==norm(segment.text)) throw new Error('alignment');
        return {...segment,text:bounded.segments.slice(from,cursor).map(s=>s.text.trim()).join(' ')};
      });
      if(cursor!==cloudSegments.length) throw new Error('alignment');
      evidence.splice(0,evidence.length,...alignTranscriptPrivacyEvidence(evidence,bounded.segments,persistedSegments));
    } catch {
      await deps.persistError('text_privacy_alignment_failed');
      return {state:'error',reason:'text_privacy_alignment_failed'};
    }
  }
  await deps.persistSuccess({
    segments: persistedSegments,
    metrics: scoreOutcome.score.metrics,
    summary: scoreOutcome.score.summary,
    models: input.publishedVersionModels,
    providerTokens,
    ...(evidence.length ? {evidence}:{}),
  });

  // D-46: prefer positive hangup/job audioMs; else STT durationSec→ms when known.
  const hangupAudioMs = typeof input.audioMs === 'number' && Number.isFinite(input.audioMs)
    ? input.audioMs
    : 0;
  const sttAudioMs = typeof sttOutcome.stt.durationSec === 'number'
    && Number.isFinite(sttOutcome.stt.durationSec)
    && sttOutcome.stt.durationSec > 0
    ? Math.round(sttOutcome.stt.durationSec * 1000)
    : 0;
  const chargeAudioMs = hangupAudioMs > 0 ? hangupAudioMs : sttAudioMs;

  await deps.invokeSaChargeRun(
    {
      runId: input.runId,
      tenantUid: input.tenantUid,
      audioMs: chargeAudioMs,
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
