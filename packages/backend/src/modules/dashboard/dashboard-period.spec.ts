import { resolveDashboardPeriod } from './dashboard-period';
describe('Dashboard organization periods', () => {
  const now = new Date('2026-10-11T20:30:00Z');
  it('uses organization midnight, not host timezone', () => {
    expect(resolveDashboardPeriod({ period: 'today' }, 'Asia/Krasnoyarsk', now)).toEqual({ from: '2026-10-11T17:00:00.000Z', to: now.toISOString(), timezone: 'Asia/Krasnoyarsk' });
    expect(resolveDashboardPeriod({ period: 'yesterday' }, 'Asia/Krasnoyarsk', now).to).toBe('2026-10-11T17:00:00.000Z');
  });
  it('handles daylight savings midnight boundaries', () => {
    const result = resolveDashboardPeriod({ period: 'yesterday' }, 'America/New_York', new Date('2026-03-09T15:00:00Z'));
    expect(Date.parse(result.to) - Date.parse(result.from)).toBe(23 * 3600000);
  });
  it('validates custom bounds, zone and maximum period', () => {
    expect(() => resolveDashboardPeriod({ period: 'custom', from: '2026-01-01', to: '2026-01-02' })).toThrow();
    expect(() => resolveDashboardPeriod({ period: 'custom', from: '2026-01-01T00:00:00Z', to: '2026-02-02T00:00:00Z' })).toThrow();
    expect(() => resolveDashboardPeriod({}, 'Invalid/Timezone')).toThrow();
  });
});
