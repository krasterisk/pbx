import { describeInsightsPeriod } from './insights-period';

describe('describeInsightsPeriod', () => {
  it('compares a Moscow calendar month with the previous calendar month', () => {
    const period = describeInsightsPeriod('2026-08-31T21:00:00.000Z', '2026-09-30T20:59:59.999Z');
    expect(period.current.startDate).toBe('2026-09-01');
    expect(period.current.endDate).toBe('2026-09-30');
    expect(period.previous.startDate).toBe('2026-08-01');
    expect(period.previous.endDate).toBe('2026-08-31');
    expect(period.previous.from).toBe('2026-07-31T21:00:00.000Z');
    expect(period.previous.to).toBe('2026-08-31T20:59:59.999Z');
  });

  it('compares a Monday week with the previous Monday week', () => {
    const period = describeInsightsPeriod('2026-09-27T21:00:00.000Z', '2026-10-04T20:59:59.999Z');
    expect(period.current).toMatchObject({ startDate: '2026-09-28', endDate: '2026-10-04' });
    expect(period.previous).toMatchObject({ startDate: '2026-09-21', endDate: '2026-09-27' });
  });

  it('compares one day with the previous day', () => {
    const period = describeInsightsPeriod('2026-09-28T21:00:00.000Z', '2026-09-29T20:59:59.999Z');
    expect(period.current.startDate).toBe('2026-09-29');
    expect(period.previous.startDate).toBe('2026-09-28');
    expect(period.previous.endDate).toBe('2026-09-28');
  });

  it('compares a custom three-day range with the three days before it', () => {
    const period = describeInsightsPeriod('2026-09-09T21:00:00.000Z', '2026-09-12T20:59:59.999Z');
    expect(period.current).toMatchObject({ startDate: '2026-09-10', endDate: '2026-09-12' });
    expect(period.previous).toMatchObject({ startDate: '2026-09-07', endDate: '2026-09-09' });
  });

  it('compares a calendar year with the previous calendar year', () => {
    const period = describeInsightsPeriod('2025-12-31T21:00:00.000Z', '2026-12-31T20:59:59.999Z');
    expect(period.current).toMatchObject({ startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(period.previous).toMatchObject({ startDate: '2025-01-01', endDate: '2025-12-31' });
  });
});
