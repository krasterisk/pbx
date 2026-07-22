import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadActiveShift,
  saveActiveShift,
  clearActiveShift,
  CC_ACTIVE_SHIFT_KEY,
} from './shiftSession';

describe('shiftSession', () => {
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
  };

  beforeEach(() => mem.clear());

  it('round-trips a valid shift', () => {
    saveActiveShift(
      {
        interface: 'PJSIP/ew112_0',
        queues: ['q700_0'],
        mode: 'webrtc',
        endpointId: 'e112_0',
        sipId: 'ew112_0',
      },
      storage,
    );
    expect(loadActiveShift(storage)?.interface).toBe('PJSIP/ew112_0');
    expect(mem.has(CC_ACTIVE_SHIFT_KEY)).toBe(true);
  });

  it('clears and rejects invalid JSON', () => {
    storage.setItem(CC_ACTIVE_SHIFT_KEY, '{bad');
    expect(loadActiveShift(storage)).toBeNull();
    clearActiveShift(storage);
    expect(loadActiveShift(storage)).toBeNull();
  });
});
