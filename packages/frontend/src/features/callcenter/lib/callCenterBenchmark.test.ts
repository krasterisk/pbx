import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); window.history.replaceState(null, '', '/'); });

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
    window.history.replaceState(null, '', '/?ccTransport=invalid');
    expect(benchmarkTransport()).toBe('websocket');
  });
});
