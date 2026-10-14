import { normalizeTenantDashboardFields } from './tenant-dashboard-fields';

describe('tenant dashboard settings', () => {
  it('keeps nullable unknown limits and validates a real IANA timezone', () => {
    expect(normalizeTenantDashboardFields({ plan_name: '  PBX Pro ', max_concurrent_calls: null, timezone: 'Asia/Krasnoyarsk' }))
      .toEqual({ plan_name: 'PBX Pro', max_concurrent_calls: null, timezone: 'Asia/Krasnoyarsk' });
    expect(normalizeTenantDashboardFields({}, 'UTC')).toEqual({ timezone: 'UTC' });
    expect(normalizeTenantDashboardFields({})).toEqual({});
  });
  it('normalizes expiry and permits clearing the assignment', () => {
    expect(normalizeTenantDashboardFields({ plan_expires_at: '2026-12-31' }).plan_expires_at).toEqual(new Date('2026-12-31T00:00:00Z'));
    expect(normalizeTenantDashboardFields({ plan_expires_at: null, plan_name: '' })).toEqual({ plan_expires_at: null, plan_name: null });
  });
  it.each(['Europe/Imaginary', '', 'UTC+5', null])('rejects timezone %s', (timezone) => {
    expect(() => normalizeTenantDashboardFields({ timezone: timezone as string })).toThrow();
  });
  it.each([-1, 1.5, 1_000_001, '12'])('rejects invalid concurrency %s', (value) => {
    expect(() => normalizeTenantDashboardFields({ max_concurrent_calls: value as number })).toThrow();
  });
  it.each(['2026-02-31', 'tomorrow', '2026-02-01T12:00:00'])('rejects ambiguous or invalid expiry %s', (value) => {
    expect(() => normalizeTenantDashboardFields({ plan_expires_at: value })).toThrow();
  });
});
