import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); document.body.textContent = ''; window.history.replaceState(null, '', '/'); });

describe('transport benchmark isolation', () => {
  it('ignores the SSE query switch in an ordinary application build', async () => {
    vi.stubEnv('VITE_CC_BENCHMARK', 'false');
    window.history.replaceState(null, '', '/?ccTransport=sse');
    const { benchmarkTransport } = await import('./callCenterBenchmark');
    expect(benchmarkTransport()).toBe('websocket');
  });

  it('selects legacy SSE only in an explicitly enabled benchmark build', async () => {
    vi.stubEnv('VITE_CC_BENCHMARK', 'true');
    window.history.replaceState(null, '', '/?ccTransport=sse');
    const { benchmarkTransport } = await import('./callCenterBenchmark');
    expect(benchmarkTransport()).toBe('sse');
    window.history.replaceState(null, '', '/?sort=name');
    expect(benchmarkTransport()).toBe('sse');
  });

  it('records snapshot population and row status without requiring the performance observer', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_CC_BENCHMARK', 'true');
    vi.stubGlobal('PerformanceObserver', undefined);
    const { recordBenchmarkEvent } = await import('./callCenterBenchmark');
    expect(() => recordBenchmarkEvent('fullSnapshot', '{"agents":[{}],"queues":[{}],"calls":[{}]}')).not.toThrow();
    const row = document.createElement('div');
    row.dataset.callId = 'synthetic-call';
    row.dataset.status = 'TALKING';
    document.body.append(row);
    recordBenchmarkEvent('callUpdate', '{"uniqueid":"synthetic-call","status":"HOLD"}');
    row.dataset.status = 'HOLD';
    await Promise.resolve();
    vi.advanceTimersByTime(2000);
    const data = JSON.parse(document.querySelector('[data-testid="callcenter-benchmark-results"]')!.textContent!);
    expect(data.snapshot).toMatchObject({ agents: 1, calls: 1, queues: 1 });
    expect(data.samples[0].domAt).toEqual(expect.any(Number));
    expect(data.observerErrors).toBe(0);
  });
});
