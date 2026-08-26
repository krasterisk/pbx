import { sanitizeShiftPolicy, DEFAULT_TENANT_SETTINGS } from './callcenter-settings.service';
import { DEFAULT_SHIFT_POLICY } from './models/shift-policy.types';

describe('sanitizeShiftPolicy', () => {
  it('merges defaults and drops invalid eod_time', () => {
    const out = sanitizeShiftPolicy(
      {
        max_duration_min: 480,
        close_at_eod: true,
        eod_time: '25:99',
        idle_timeout_min: 30,
        free_exten_on_close: false,
        unknown: 1,
      } as any,
      null,
    );
    expect(out.max_duration_min).toBe(480);
    expect(out.close_at_eod).toBe(true);
    expect(out.eod_time).toBe(DEFAULT_SHIFT_POLICY.eod_time);
    expect(out.idle_timeout_min).toBe(30);
    expect(out.free_exten_on_close).toBe(false);
    expect(out).not.toHaveProperty('unknown');
  });

  it('is included in DEFAULT_TENANT_SETTINGS', () => {
    expect(DEFAULT_TENANT_SETTINGS.shift_policy).toEqual(DEFAULT_SHIFT_POLICY);
  });
});
