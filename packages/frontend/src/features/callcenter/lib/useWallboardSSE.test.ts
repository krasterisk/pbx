import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_KPI_THRESHOLDS } from './kpiThresholds';
import { useWallboardSSE } from './useWallboardSSE';

const dispatch = vi.fn();
vi.mock('react-redux', () => ({ useDispatch: () => dispatch }));

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, (e: MessageEvent) => void>();
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners.set(type, cb);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown) {
    this.listeners.get(type)?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

describe('useWallboardSSE thresholds', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    dispatch.mockClear();
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts from the backend-matching defaults before the server sends settings', () => {
    const { result } = renderHook(() => useWallboardSSE('tok'));
    expect(result.current.thresholds).toEqual(DEFAULT_KPI_THRESHOLDS);
  });

  it('applies the tenant thresholds pushed on the display-token stream', () => {
    const { result } = renderHook(() => useWallboardSSE('tok'));
    act(() => {
      FakeEventSource.instances[0].emit('thresholds', {
        sla_critical_pct: 85,
        max_wait_sec: 45,
        abandon_rate_pct: 8,
        agents_available_min: 0,
      });
    });
    expect(result.current.thresholds).toEqual({
      slaCriticalPct: 85,
      maxWaitSec: 45,
      abandonRatePct: 8,
      agentsAvailableMin: 0,
    });
  });

  it('ignores a malformed thresholds event and keeps the previous values', () => {
    const { result } = renderHook(() => useWallboardSSE('tok'));
    act(() => {
      FakeEventSource.instances[0].listeners.get('thresholds')?.({ data: '{broken' } as MessageEvent);
    });
    expect(result.current.thresholds).toEqual(DEFAULT_KPI_THRESHOLDS);
  });

  it('does not open a stream without a token', () => {
    renderHook(() => useWallboardSSE(null));
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
