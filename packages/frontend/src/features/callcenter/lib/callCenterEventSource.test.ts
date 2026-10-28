import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCallCenterEventSource } from './callCenterEventSource';

const mocks = vi.hoisted(() => ({
  io: vi.fn(),
  handlers: new Map<string, (...args: any[]) => void>(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
}));
vi.mock('socket.io-client', () => ({ io: mocks.io }));

describe('call center WebSocket event transport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.io.mockReturnValue({
      on: (name: string, fn: (...args: any[]) => void) =>
        mocks.handlers.set(name, fn),
      connect: mocks.connect,
      disconnect: mocks.disconnect,
      removeAllListeners: mocks.removeAllListeners,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a rejected namespace at most once per ten seconds and cancels on close', () => {
    const source = createCallCenterEventSource('/api', 'fixture-token');
    mocks.handlers.get('connect_error')!();
    mocks.handlers.get('disconnect')!();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(9999);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(mocks.connect).toHaveBeenCalledTimes(2);
    mocks.handlers.get('connect_error')!();
    source.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses authenticated WebSocket only, leaving HTTP slots available to API requests', () => {
    const source = createCallCenterEventSource('/api', 'fixture-token');
    expect(mocks.io).toHaveBeenCalledWith(
      expect.stringContaining('/callcenter-events'),
      expect.objectContaining({
        transports: ['websocket'],
        auth: { token: 'fixture-token' },
        forceNew: true,
        autoConnect: false,
      }),
    );
    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(source.readyState).toBe(0);
    source.onopen = vi.fn();
    mocks.handlers.get('connect')!();
    expect(source.readyState).toBe(1);
    expect(source.onopen).toHaveBeenCalledOnce();
    source.close();
  });

  it('delivers snapshot and heartbeat without changing the existing message contract', () => {
    const source = createCallCenterEventSource(
      'https://fixture.example/api',
      'fixture-token',
    );
    const snapshot = vi.fn(),
      heartbeat = vi.fn();
    source.addEventListener('fullSnapshot', snapshot);
    source.addEventListener('heartbeat', heartbeat);
    mocks.handlers.get('cc:event')!({
      type: 'fullSnapshot',
      data: '{"agents":[]}',
    });
    mocks.handlers.get('cc:event')!({ type: 'heartbeat', data: '1' });
    expect(snapshot).toHaveBeenCalledWith(
      expect.objectContaining({ data: '{"agents":[]}' }),
    );
    expect(heartbeat).toHaveBeenCalledWith(
      expect.objectContaining({ data: '1' }),
    );
    source.close();
  });

  it('reports outages, then recovers; closing prevents later events and reconnects', () => {
    const source = createCallCenterEventSource('/api', 'fixture-token');
    source.onerror = vi.fn();
    source.onopen = vi.fn();
    mocks.handlers.get('connect_error')!();
    expect(source.onerror).toHaveBeenCalledOnce();
    mocks.handlers.get('connect')!();
    expect(source.readyState).toBe(1);
    const listener = vi.fn();
    source.addEventListener('agentUpdate', listener);
    source.close();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(mocks.removeAllListeners).toHaveBeenCalledOnce();
    mocks.handlers.get('cc:event')!({ type: 'agentUpdate', data: '{}' });
    mocks.handlers.get('disconnect')!();
    expect(source.readyState).toBe(2);
    expect(listener).not.toHaveBeenCalled();
    expect(source.onerror).toHaveBeenCalledOnce();
  });
});
