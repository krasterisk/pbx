import { describe, it, expect } from 'vitest';
import { customRange, hasDashboardValue, periodQuery, sectionLink } from './dashboardView';
describe('PBX dashboard bounded filters', () => {
  it('uses organization calendar dates rather than browser timezone', () => {
    expect(customRange('2026-10-11', '2026-10-11', 'Asia/Krasnoyarsk')).toEqual({ period: 'custom', from: '2026-10-10T17:00:00.000Z', to: '2026-10-11T17:00:00.000Z' });
  });
  it('preserves DST calendar-day boundaries', () => {
    const range = customRange('2026-11-01', '2026-11-01', 'America/New_York');
    expect(range?.from).toBe('2026-11-01T04:00:00.000Z');
    expect(range?.to).toBe('2026-11-02T05:00:00.000Z');
  });
  it('accepts exactly31days and rejects longer, invalid or reversed ranges', () => {
    expect(customRange('2026-10-01', '2026-10-31')).toBeDefined();
    expect(customRange('2026-10-01', '2026-11-01')).toBeUndefined();
    expect(customRange('2026-10-11', '2026-10-10')).toBeUndefined();
    expect(customRange('2026-02-30', '2026-03-01')).toBeUndefined();
    expect(customRange('', '')).toBeUndefined();
    expect(customRange('2026-10-11', '2026-10-11', 'Invalid/Timezone')).toBeUndefined();
  });
  it('distinguishes zero data from unavailable while preserving stale measurements', () => {
    expect(hasDashboardValue({ state: 'ok', updatedAt: null })).toBe(true);
    expect(hasDashboardValue({ state: 'stale', updatedAt: null })).toBe(true);
    expect(hasDashboardValue({ state: 'unavailable', updatedAt: null })).toBe(false);
    expect(hasDashboardValue({ state: 'notConfigured', updatedAt: null })).toBe(false);
  });
  it('uses bounded inventory routes and preserves selected status/search', () => {
    expect(sectionLink('endpoints', { status:'offline',search:'100' })).toBe('/endpoints?dashboard=1&search=100&status=offline');
    expect(sectionLink('trunks', { status:'unknown' })).toBe('/trunks?dashboard=1&status=unknown');
  });
  it('uses a logicalcall journal so accepted and missed do not become raw CDR dispositions', () => {
    const link = sectionLink('calls', { ...periodQuery({ from:'2026-10-01T00:00:00Z', to:'2026-10-02T00:00:00Z', timezone:'UTC' }), direction:'in', outcome:'missed', origin:'ai', state:'waiting', search:'100' })!;
    const url = new URL(link, 'http://localhost');
    expect(url.pathname).toBe('/reports/cdr');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ dashboard:'1', from:'2026-10-01T00:00:00Z', to:'2026-10-02T00:00:00Z', outcome:'missed', direction:'in', origin:'ai', state:'waiting', search:'100' });
    expect(url.searchParams.has('disposition')).toBe(false);
    expect(sectionLink('system', {})).toBeUndefined();
  });
});
