import * as fs from 'node:fs';
import * as path from 'node:path';
import { invokeSaChargeRun } from '../charging/sa-charge-run';
import { runAnalysis, resolveAnalysisModels } from './run-analysis';
import type { RunAnalysisDeps, RunAnalysisInput } from './run-analysis';

const ALLOWLIST = ['stt-default', 'stt-project', 'score-default', 'score-project'];

function baseInput(overrides: Partial<RunAnalysisInput> = {}): RunAnalysisInput {
  return {
    runId: 'run-mono-1',
    tenantUid: 8,
    audioPath: '/tmp/mono.wav',
    audioMs: 12_000,
    currency: 'RUB',
    channelSource: 'upload',
    swapChannels: false,
    channels: 1,
    stereoVerified: false,
    moduleDefaults: { sttModelId: 'stt-default', scoreModelId: 'score-default' },
    projectOverrides: {},
    publishedVersionModels: { sttModelId: 'stt-default', scoreModelId: 'score-default' },
    platformAllowlist: ALLOWLIST,
    ...overrides,
  };
}

describe('runAnalysis (D-23, D-38, D-46)', () => {
  it('persists transcript and metrics then calls invokeSaChargeRun once on success (incl. amount 0)', async () => {
    const invokeCharge = jest.fn(invokeSaChargeRun);
    const persistSuccess = jest.fn(async () => undefined);
    const persistError = jest.fn(async () => undefined);
    const stt = jest.fn(async () => ({
      text: 'здравствуйте, чем могу помочь',
      durationSec: 12,
      segments: [{ start: 0, end: 2, text: 'здравствуйте, чем могу помочь' }],
      providerTokens: 0,
      modelId: 'stt-default',
    }));
    const score = jest.fn(async () => ({
      metrics: [{ id: 'greeting_present', status: 'scored', value: true }],
      summary: 'greeting ok',
      providerTokens: 10,
      modelId: 'score-default',
    }));
    const diarize = jest.fn(async ({ segments }: { segments: Array<{ text: string }> }) => ({
      mode: 'llm_roles' as const,
      segments: segments.map((s, i) => ({
        id: `seg-${i}`,
        ordinal: i,
        startMs: 0,
        endMs: 2000,
        channel: 0,
        speakerRole: 'operator' as const,
        roleSource: 'llm' as const,
        text: s.text,
      })),
      requestSecondStt: false,
    }));

    const deps: RunAnalysisDeps = {
      stt,
      score,
      diarize,
      persistSuccess,
      persistError,
      invokeSaChargeRun: invokeCharge,
      findLatestRates: async () => [],
      updateRunCharge: async () => undefined,
    };

    const result = await runAnalysis(baseInput(), deps);

    expect(result.state).toBe('completed');
    expect(persistSuccess).toHaveBeenCalledTimes(1);
    expect(persistSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        models: { sttModelId: 'stt-default', scoreModelId: 'score-default' },
      }),
    );
    expect(persistError).not.toHaveBeenCalled();
    expect(invokeCharge).toHaveBeenCalledTimes(1);
    expect(invokeCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-mono-1',
        tenantUid: 8,
        audioMs: 12_000,
        currency: 'RUB',
      }),
      expect.any(Object),
    );
    expect(stt).toHaveBeenCalledTimes(1);
    expect(score).toHaveBeenCalledTimes(1);
  });

  it('marks error and skips invokeSaChargeRun when scoring fails', async () => {
    const invokeCharge = jest.fn(invokeSaChargeRun);
    const persistSuccess = jest.fn(async () => undefined);
    const persistError = jest.fn(async () => undefined);

    const deps: RunAnalysisDeps = {
      stt: async () => ({
        text: 'hello',
        durationSec: 5,
        segments: [{ start: 0, end: 1, text: 'hello' }],
        providerTokens: 1,
        modelId: 'stt-default',
      }),
      score: async () => null,
      diarize: async ({ segments }) => ({
        mode: 'llm_roles',
        segments: segments.map((s, i) => ({
          id: `seg-${i}`,
          ordinal: i,
          startMs: 0,
          endMs: 1000,
          channel: 0,
          speakerRole: 'unknown' as const,
          roleSource: 'llm' as const,
          text: s.text,
        })),
        requestSecondStt: false,
      }),
      persistSuccess,
      persistError,
      invokeSaChargeRun: invokeCharge,
      findLatestRates: async () => [],
      updateRunCharge: async () => undefined,
    };

    const result = await runAnalysis(baseInput({ runId: 'run-err-1' }), deps);

    expect(result.state).toBe('error');
    expect(persistError).toHaveBeenCalled();
    expect(persistSuccess).not.toHaveBeenCalled();
    expect(invokeCharge).not.toHaveBeenCalled();
  });

  it('does not use fakeStt on the success path', async () => {
    const pipelineSrc = fs.readFileSync(
      path.join(__dirname, '..', 'pipeline.ts'),
      'utf8',
    );
    const runSrc = fs.readFileSync(path.join(__dirname, 'run-analysis.ts'), 'utf8');
    const sttSrc = fs.readFileSync(path.join(__dirname, 'stt.ts'), 'utf8');

    expect(runSrc).not.toMatch(/\bfakeStt\b/);
    expect(sttSrc).not.toMatch(/\bfakeStt\b/);
    // Product success orchestration lives in runAnalysis, not runPipeline/fakeStt
    expect(runSrc).toMatch(/invokeSaChargeRun/);
    expect(pipelineSrc).toMatch(/fakeStt/); // legacy eval helper may remain, unused by worker
  });

  it('resolves models per D-38: project override, else module default; silence falls back once', () => {
    expect(
      resolveAnalysisModels({
        moduleDefaults: { sttModelId: 'stt-default', scoreModelId: 'score-default' },
        projectOverrides: { sttModelId: 'stt-project' },
        platformAllowlist: ALLOWLIST,
      }),
    ).toEqual({
      primary: { sttModelId: 'stt-project', scoreModelId: 'score-default' },
      fallback: { sttModelId: 'stt-default', scoreModelId: 'score-default' },
    });

    expect(
      resolveAnalysisModels({
        moduleDefaults: { sttModelId: 'stt-default', scoreModelId: 'score-default' },
        projectOverrides: {},
        platformAllowlist: ALLOWLIST,
      }).primary,
    ).toEqual({ sttModelId: 'stt-default', scoreModelId: 'score-default' });

    expect(() =>
      resolveAnalysisModels({
        moduleDefaults: { sttModelId: 'hidden-offlist', scoreModelId: 'score-default' },
        projectOverrides: {},
        platformAllowlist: ALLOWLIST,
      }),
    ).toThrow(/allowlist|platform/i);
  });

  it('retries module default when project model is silent, then errors without charge if both fail', async () => {
    const invokeCharge = jest.fn();
    const persistError = jest.fn(async () => undefined);
    const stt = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const deps: RunAnalysisDeps = {
      stt,
      score: jest.fn(),
      diarize: jest.fn(),
      persistSuccess: jest.fn(),
      persistError,
      invokeSaChargeRun: invokeCharge,
      findLatestRates: async () => [],
      updateRunCharge: async () => undefined,
    };

    const result = await runAnalysis(
      baseInput({
        runId: 'run-silent',
        projectOverrides: { sttModelId: 'stt-project' },
        publishedVersionModels: { sttModelId: 'stt-project', scoreModelId: 'score-default' },
      }),
      deps,
    );

    expect(result.state).toBe('error');
    expect(stt).toHaveBeenCalledTimes(2);
    expect(stt.mock.calls[0][0].modelId).toBe('stt-project');
    expect(stt.mock.calls[1][0].modelId).toBe('stt-default');
    expect(invokeCharge).not.toHaveBeenCalled();
    expect(persistError).toHaveBeenCalled();
  });

  it('uses STT durationSec*1000 for SA-CHARGE-RUN when hangup audioMs is 0 or unknown (D-46)', async () => {
    const invokeCharge = jest.fn(async () => ({ amount: '0', currency: 'RUB', charged: false as const }));
    const deps: RunAnalysisDeps = {
      stt: async () => ({
        text: 'hi',
        durationSec: 37.4,
        segments: [{ start: 0, end: 1, text: 'hi' }],
        providerTokens: 2,
        modelId: 'stt-default',
      }),
      score: async () => ({
        metrics: [],
        summary: 'ok',
        providerTokens: 1,
        modelId: 'score-default',
      }),
      diarize: async ({ segments }) => ({
        mode: 'llm_roles',
        segments: segments.map((s, i) => ({
          id: `seg-${i}`,
          ordinal: i,
          startMs: 0,
          endMs: 1000,
          channel: 0,
          speakerRole: 'operator' as const,
          roleSource: 'llm' as const,
          text: s.text,
        })),
        requestSecondStt: false,
      }),
      persistSuccess: async () => undefined,
      persistError: async () => undefined,
      invokeSaChargeRun: invokeCharge,
      findLatestRates: async () => [],
      updateRunCharge: async () => undefined,
    };

    const result = await runAnalysis(baseInput({ runId: 'run-stt-fallback', audioMs: 0 }), deps);

    expect(result.state).toBe('completed');
    expect(invokeCharge).toHaveBeenCalledWith(
      expect.objectContaining({ audioMs: Math.round(37.4 * 1000) }),
      expect.any(Object),
    );
  });

  it('prefers positive hangup audioMs over STT duration for SA-CHARGE-RUN (D-46)', async () => {
    const invokeCharge = jest.fn(async () => ({ amount: '0', currency: 'RUB', charged: false as const }));
    const deps: RunAnalysisDeps = {
      stt: async () => ({
        text: 'hi',
        durationSec: 99,
        segments: [{ start: 0, end: 1, text: 'hi' }],
        providerTokens: 2,
        modelId: 'stt-default',
      }),
      score: async () => ({
        metrics: [],
        summary: 'ok',
        providerTokens: 1,
        modelId: 'score-default',
      }),
      diarize: async ({ segments }) => ({
        mode: 'llm_roles',
        segments: segments.map((s, i) => ({
          id: `seg-${i}`,
          ordinal: i,
          startMs: 0,
          endMs: 1000,
          channel: 0,
          speakerRole: 'operator' as const,
          roleSource: 'llm' as const,
          text: s.text,
        })),
        requestSecondStt: false,
      }),
      persistSuccess: async () => undefined,
      persistError: async () => undefined,
      invokeSaChargeRun: invokeCharge,
      findLatestRates: async () => [],
      updateRunCharge: async () => undefined,
    };

    const result = await runAnalysis(baseInput({ runId: 'run-hangup-wins', audioMs: 45_000 }), deps);

    expect(result.state).toBe('completed');
    expect(invokeCharge).toHaveBeenCalledWith(
      expect.objectContaining({ audioMs: 45_000 }),
      expect.any(Object),
    );
    expect(invokeCharge.mock.calls[0][0].audioMs).not.toBe(99_000);
  });
});
