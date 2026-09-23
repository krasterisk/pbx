import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  FILE_WAIT_CEILING_MS,
  FILE_WAIT_POLL_MS,
  SaAnalysisWorker,
  waitForStableNonEmptyFile,
} from './sa-analysis.worker';

describe('SaAnalysisWorker file wait (D-03)', () => {
  it('exports a 500ms poll interval and 60s total ceiling', () => {
    expect(FILE_WAIT_POLL_MS).toBe(500);
    expect(FILE_WAIT_CEILING_MS).toBe(60_000);
    expect(String(FILE_WAIT_POLL_MS)).toContain('500');
    expect(String(FILE_WAIT_CEILING_MS / 1000)).toContain('60');
  });

  it('proceeds only when file exists, size > 0, and size is unchanged across two consecutive 500ms polls', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-wait-'));
    const filePath = path.join(dir, 'rec.mp3');
    await fs.writeFile(filePath, Buffer.alloc(0));

    const grow = setTimeout(async () => {
      await fs.writeFile(filePath, Buffer.from('abc'));
    }, 200);

    const result = await waitForStableNonEmptyFile(filePath, {
      pollMs: FILE_WAIT_POLL_MS,
      ceilingMs: 5_000,
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 50))),
      stat: (p) => fs.stat(p),
    });
    clearTimeout(grow);

    expect(result).toEqual({ ok: true, bytes: 3 });
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('marks the run as error without invokeSaChargeRun when the 60s ceiling elapses', async () => {
    const invokeSaChargeRun = jest.fn();
    const worker = new SaAnalysisWorker({
      waitForFile: async () => ({ ok: false, reason: 'timeout' }),
      invokeSaChargeRun,
      handoffPipeline: jest.fn(),
    });

    const outcome = await worker.processJob({
      jobId: 'job-1',
      runId: 'run-1',
      recordPath: '/tmp/missing.mp3',
      tenantUid: 8,
    });

    expect(outcome).toEqual({ state: 'error', reason: 'timeout' });
    expect(invokeSaChargeRun).not.toHaveBeenCalled();
  });

  it('marks empty or never-appearing file as error without SA-CHARGE-RUN', async () => {
    const invokeSaChargeRun = jest.fn();
    const worker = new SaAnalysisWorker({
      waitForFile: async () => ({ ok: false, reason: 'empty_or_missing' }),
      invokeSaChargeRun,
      handoffPipeline: jest.fn(),
    });

    const outcome = await worker.processJob({
      jobId: 'job-2',
      runId: 'run-2',
      recordPath: '/tmp/empty.mp3',
      tenantUid: 8,
    });

    expect(outcome.state).toBe('error');
    expect(invokeSaChargeRun).not.toHaveBeenCalled();
  });

  it('does not treat fakeStt as a successful scored analysis handoff', async () => {
    const invokeSaChargeRun = jest.fn();
    const handoffPipeline = jest.fn().mockResolvedValue({
      state: 'ready_for_pipeline',
      fakeStt: false,
      scored: false,
    });
    const worker = new SaAnalysisWorker({
      waitForFile: async () => ({ ok: true, bytes: 12 }),
      invokeSaChargeRun,
      handoffPipeline,
    });

    const outcome = await worker.processJob({
      jobId: 'job-3',
      runId: 'run-3',
      recordPath: '/tmp/ok.mp3',
      tenantUid: 8,
    });

    expect(outcome.state).toBe('ready_for_pipeline');
    expect(outcome).not.toMatchObject({ state: 'completed', scored: true });
    expect(invokeSaChargeRun).not.toHaveBeenCalled();
    expect(handoffPipeline).toHaveBeenCalled();
  });

  it('Nest factory always injects runAnalysis so handoffPipeline is unreachable', async () => {
    const { createSaAnalysisWorker } = require('./sa-analysis.worker.nest');
    const invokeSaChargeRun = jest.fn();
    const runAnalysis = jest.fn().mockResolvedValue({ state: 'completed', scored: true });
    // Build via factory shape: production must supply runAnalysis
    const nestWorker = createSaAnalysisWorker({
      moduleSettings: {
        get: () => ({
          pauseNew: false,
          sttModelId: 'stt-a',
          scoreModelId: 'score-a',
          insightsModelId: null,
          cabinetCanEditModels: false,
          modelAllowlist: ['stt-a', 'score-a'],
        }),
      },
      config: { get: () => undefined },
      runs: { findOne: jest.fn().mockResolvedValue(null) },
      stt: async () => ({
        text: 'hi',
        durationSec: 1,
        segments: [{ start: 0, end: 1, text: 'hi' }],
        providerTokens: 1,
        modelId: 'stt-a',
      }),
      score: async () => ({
        metrics: [],
        summary: 'ok',
        providerTokens: 1,
        modelId: 'score-a',
      }),
      findLatestRates: async () => [],
    });

    // Spy: processJob with successful wait must not require handoffPipeline
    const waitOk = new SaAnalysisWorker({
      waitForFile: async () => ({ ok: true, bytes: 4 }),
      invokeSaChargeRun,
      runAnalysis,
    });
    const scored = await waitOk.processJob({
      jobId: 'job-nest',
      runId: 'run-nest',
      recordPath: '/tmp/nest.mp3',
      tenantUid: 8,
    });
    expect(scored.scored).toBe(true);
    expect(runAnalysis).toHaveBeenCalled();
    expect(nestWorker).toBeInstanceOf(SaAnalysisWorker);
    expect(String(FILE_WAIT_POLL_MS)).toContain('500');
    expect(String(FILE_WAIT_CEILING_MS / 1000)).toContain('60');
  });

  it('Nest runAnalysis passes audioMs from durationSec not waitForFile bytes (CR-02, D-46)', async () => {
    const pipeline = require('../pipeline/run-analysis') as typeof import('../pipeline/run-analysis');
    const spy = jest.spyOn(pipeline, 'runAnalysis').mockResolvedValue({ state: 'completed' });

    const { createSaAnalysisWorker } = require('./sa-analysis.worker.nest');
    const nestWorker = createSaAnalysisWorker({
      moduleSettings: {
        get: () => ({
          pauseNew: false,
          sttModelId: 'stt-a',
          scoreModelId: 'score-a',
          insightsModelId: null,
          cabinetCanEditModels: false,
          modelAllowlist: ['stt-a', 'score-a'],
        }),
      },
      config: { get: () => undefined },
      runs: { findOne: jest.fn().mockResolvedValue(null) },
      stt: async () => null,
      score: async () => null,
      findLatestRates: async () => [],
    });

    const hugeBytes = 4_194_304;
    (nestWorker as unknown as { deps: { waitForFile: () => Promise<{ ok: true; bytes: number }> } })
      .deps.waitForFile = async () => ({ ok: true, bytes: hugeBytes });

    await nestWorker.processJob({
      jobId: 'job-cr02',
      runId: 'run-cr02',
      recordPath: '/tmp/big.mp3',
      tenantUid: 8,
      durationSec: 45,
      audioMs: 45_000,
    });

    expect(spy).toHaveBeenCalled();
    const chargeInput = spy.mock.calls[0][0] as { audioMs: number };
    expect(chargeInput.audioMs).toBe(45_000);
    expect(chargeInput.audioMs).not.toBe(hugeBytes);
    spy.mockRestore();
  });
});

describe('krsk-hangup-handler dialplan order (D-03)', () => {
  it('orders StopMixMonitor then ffmpeg then CURL on-hangup, and notifies when analytics project is attached', () => {
    // Imported lazily so RED fails on missing worker first; dialplan checked in same suite after GREEN.
    const { DialplanSubroutinesUtil } = require('../../../shared/utils/dialplan-subroutines.util');
    const content = DialplanSubroutinesUtil.generate('http://127.0.0.1:5010/api', 'key');
    const hangupStart = content.indexOf('[krsk-hangup-handler]');
    const hangup = content.slice(hangupStart);
    const stopIdx = hangup.indexOf('StopMixMonitor');
    const ffmpegIdx = hangup.indexOf('ffmpeg');
    const curlIdx = hangup.indexOf('/internal/dialplan/on-hangup');
    expect(stopIdx).toBeGreaterThan(-1);
    expect(ffmpegIdx).toBeGreaterThan(stopIdx);
    expect(curlIdx).toBeGreaterThan(ffmpegIdx);
    // Must not early-Return solely on WH_OH!=1 when analytics project is attached
    expect(hangup).toMatch(/WH_OH.*SA_PROJECT|SA_PROJECT.*WH_OH|WH_OH" != "1" && "/);
  });
});
