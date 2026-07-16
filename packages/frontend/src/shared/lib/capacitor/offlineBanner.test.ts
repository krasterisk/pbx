import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOnlineStatus, subscribeOnlineStatus } from './offlineBanner';

describe('offlineBanner (D-35)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes navigator.onLine via getOnlineStatus', () => {
    expect(getOnlineStatus()).toBe(true);
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
    expect(getOnlineStatus()).toBe(false);
  });

  it('subscribeOnlineStatus notifies on online/offline events (no action queue)', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOnlineStatus(listener);

    window.dispatchEvent(new Event('offline'));
    expect(listener).toHaveBeenCalledWith(false);

    window.dispatchEvent(new Event('online'));
    expect(listener).toHaveBeenCalledWith(true);

    unsubscribe();
    listener.mockClear();
    window.dispatchEvent(new Event('offline'));
    expect(listener).not.toHaveBeenCalled();
  });
});
