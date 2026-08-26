import { describe, it, expect } from 'vitest';
import type { IShiftPolicy } from '@/shared/api/endpoints/callCenterApi';

/** Mirrors ShiftPolicyForm normalizePolicy for unit coverage without Radix Switch. */
function normalizePolicy(raw: IShiftPolicy | null | undefined): IShiftPolicy {
  const DEFAULT: IShiftPolicy = {
    max_duration_min: 0,
    close_at_eod: false,
    eod_time: '00:00',
    idle_timeout_min: 0,
    idle_requires_unregistered: true,
    free_exten_on_close: true,
  };
  if (!raw || typeof raw !== 'object') return { ...DEFAULT };
  return {
    max_duration_min: Number(raw.max_duration_min) >= 0 ? Number(raw.max_duration_min) : 0,
    close_at_eod: Boolean(raw.close_at_eod),
    eod_time: typeof raw.eod_time === 'string' && /^\d{2}:\d{2}$/.test(raw.eod_time)
      ? raw.eod_time
      : '00:00',
    idle_timeout_min: Number(raw.idle_timeout_min) >= 0 ? Number(raw.idle_timeout_min) : 0,
    idle_requires_unregistered: raw.idle_requires_unregistered !== false,
    free_exten_on_close: raw.free_exten_on_close !== false,
  };
}

describe('ShiftPolicyForm normalizePolicy', () => {
  it('applies defaults for empty input', () => {
    expect(normalizePolicy(null).eod_time).toBe('00:00');
    expect(normalizePolicy(undefined).free_exten_on_close).toBe(true);
  });

  it('keeps valid fields', () => {
    const out = normalizePolicy({
      max_duration_min: 480,
      close_at_eod: true,
      eod_time: '23:30',
      idle_timeout_min: 15,
      idle_requires_unregistered: false,
      free_exten_on_close: false,
    });
    expect(out).toEqual({
      max_duration_min: 480,
      close_at_eod: true,
      eod_time: '23:30',
      idle_timeout_min: 15,
      idle_requires_unregistered: false,
      free_exten_on_close: false,
    });
  });
});
