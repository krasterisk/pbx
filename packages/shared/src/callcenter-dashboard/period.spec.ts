import { CcDashboardPeriodError, daysBetweenKeys, resolveCcDashboardPeriod } from './period';

// 2026-07-15 12:00Z is 19:00 on Wednesday the 15th in Asia/Bangkok (UTC+7).
const NOW = new Date('2026-07-15T12:00:00.000Z');
const TZ = 'Asia/Bangkok';
const base = { now: NOW, timezone: TZ, compare: true };

describe('daysBetweenKeys', () => {
  it('counts both ends and crosses month and year boundaries', () => {
    expect(daysBetweenKeys('2026-07-15', '2026-07-15')).toBe(1);
    expect(daysBetweenKeys('2026-06-30', '2026-07-02')).toBe(3);
    expect(daysBetweenKeys('2025-12-31', '2026-01-01')).toBe(2);
  });
});

describe('resolveCcDashboardPeriod', () => {
  it('today: local day trimmed to now, compared with the same weekday a week ago up to the same time', () => {
    const p = resolveCcDashboardPeriod({ ...base, preset: 'today' });
    expect(p).toMatchObject({
      preset: 'today',
      timezone: TZ,
      dateFrom: '2026-07-15',
      dateTo: '2026-07-15',
      from: '2026-07-14T17:00:00.000Z',
      to: '2026-07-15T12:00:00.000Z',
      days: 1,
      includesToday: true,
    });
    expect(p.previous).toEqual({
      dateFrom: '2026-07-08',
      dateTo: '2026-07-08',
      from: '2026-07-07T17:00:00.000Z',
      to: '2026-07-08T12:00:00.000Z', // the same 19 elapsed hours, not the whole day
    });
  });

  it('yesterday: a whole closed day compared with the day before', () => {
    const p = resolveCcDashboardPeriod({ ...base, preset: 'yesterday' });
    expect(p).toMatchObject({
      dateFrom: '2026-07-14',
      dateTo: '2026-07-14',
      from: '2026-07-13T17:00:00.000Z',
      to: '2026-07-14T17:00:00.000Z',
      includesToday: false,
    });
    expect(p.previous).toEqual({
      dateFrom: '2026-07-13',
      dateTo: '2026-07-13',
      from: '2026-07-12T17:00:00.000Z',
      to: '2026-07-13T17:00:00.000Z',
    });
  });

  it('7d: seven local days ending today, previous seven trimmed to the same elapsed time', () => {
    const p = resolveCcDashboardPeriod({ ...base, preset: '7d' });
    expect(p).toMatchObject({ dateFrom: '2026-07-09', dateTo: '2026-07-15', days: 7, includesToday: true });
    expect(p.previous).toMatchObject({
      dateFrom: '2026-07-02',
      dateTo: '2026-07-08',
      from: '2026-07-01T17:00:00.000Z',
      to: '2026-07-08T12:00:00.000Z',
    });
  });

  it('30d: thirty local days', () => {
    const p = resolveCcDashboardPeriod({ ...base, preset: '30d' });
    expect(p).toMatchObject({ dateFrom: '2026-06-16', dateTo: '2026-07-15', days: 30 });
    expect(p.previous).toMatchObject({ dateFrom: '2026-05-17', dateTo: '2026-06-15' });
  });

  it('custom closed range: full previous range of the same length immediately before it', () => {
    const p = resolveCcDashboardPeriod({ ...base, preset: 'custom', dateFrom: '2026-07-01', dateTo: '2026-07-03' });
    expect(p).toMatchObject({ days: 3, includesToday: false, to: '2026-07-03T17:00:00.000Z' });
    expect(p.previous).toMatchObject({ dateFrom: '2026-06-28', dateTo: '2026-06-30', to: '2026-06-30T17:00:00.000Z' });
  });

  it('has no comparison window when compare is off', () => {
    expect(resolveCcDashboardPeriod({ ...base, compare: false, preset: '7d' }).previous).toBeNull();
  });

  it('uses the tenant day, not the server day, around local midnight', () => {
    // 18:30Z is already 01:30 on the 16th in Bangkok, but still the 15th in UTC.
    const p = resolveCcDashboardPeriod({ ...base, now: new Date('2026-07-15T18:30:00.000Z'), preset: 'today' });
    expect(p.dateFrom).toBe('2026-07-16');
    expect(resolveCcDashboardPeriod({ ...base, now: new Date('2026-07-15T18:30:00.000Z'), timezone: 'UTC', preset: 'today' }).dateFrom).toBe('2026-07-15');
  });

  it.each([
    ['missing dates', { dateFrom: undefined, dateTo: undefined }],
    ['malformed date', { dateFrom: '15.07.2026', dateTo: '2026-07-15' }],
    ['impossible date', { dateFrom: '2026-02-30', dateTo: '2026-03-01' }],
    ['inverted range', { dateFrom: '2026-07-10', dateTo: '2026-07-09' }],
    ['future end', { dateFrom: '2026-07-10', dateTo: '2026-07-16' }],
    ['more than 31 days', { dateFrom: '2026-06-01', dateTo: '2026-07-10' }],
  ])('rejects a custom period with %s', (_name, range) => {
    expect(() => resolveCcDashboardPeriod({ ...base, preset: 'custom', ...range })).toThrow(CcDashboardPeriodError);
  });

  it('rejects an unknown preset', () => {
    expect(() => resolveCcDashboardPeriod({ ...base, preset: 'decade' as never })).toThrow(CcDashboardPeriodError);
  });
});
