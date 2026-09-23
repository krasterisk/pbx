import {
  addBillingPeriod,
  isSubscriptionDue,
  listPriceRub,
  mapLegacyCycle,
  normalizeIntervalCount,
  subscriptionOperationKey,
} from './billing-period.util';

describe('billing-period.util', () => {
  const t0 = new Date('2026-01-31T12:00:00.000Z');

  it('advances hour/day/week/custom by wall duration', () => {
    expect(addBillingPeriod(t0, 'hour', 1).toISOString()).toBe('2026-01-31T13:00:00.000Z');
    expect(addBillingPeriod(t0, 'custom', 3).toISOString()).toBe('2026-01-31T15:00:00.000Z');
    expect(addBillingPeriod(t0, 'day', 1).toISOString()).toBe('2026-02-01T12:00:00.000Z');
    expect(addBillingPeriod(t0, 'week', 1).toISOString()).toBe('2026-02-07T12:00:00.000Z');
  });

  it('clamps month end when the target month is shorter', () => {
    expect(addBillingPeriod(t0, 'month', 1).toISOString()).toBe('2026-02-28T12:00:00.000Z');
    expect(addBillingPeriod(t0, 'year', 1).toISOString()).toBe('2027-01-31T12:00:00.000Z');
  });

  it('is due when last billed is missing or the period elapsed', () => {
    expect(isSubscriptionDue(t0, null, 'month', 1)).toBe(true);
    expect(isSubscriptionDue(t0, t0, 'hour', 1)).toBe(false);
    expect(isSubscriptionDue(new Date('2026-01-31T13:00:00.000Z'), t0, 'hour', 1)).toBe(true);
    expect(isSubscriptionDue(t0, t0, 'lifetime', 1)).toBe(false);
  });

  it('maps legacy cycles and reads list price from price_amount first', () => {
    expect(mapLegacyCycle('yearly')).toBe('year');
    expect(mapLegacyCycle('monthly')).toBe('month');
    expect(normalizeIntervalCount(0)).toBe(1);
    expect(listPriceRub({ price_amount: '15.50', price_monthly: 99 })).toBe(15.5);
    expect(listPriceRub({ price_monthly: 2500 })).toBe(2500);
  });

  it('builds a stable subscription operation key from last billed timestamp', () => {
    expect(subscriptionOperationKey(8, 'autodial', t0))
      .toBe('subscription:8:autodial:2026-01-31T12:00:00.000Z');
    expect(subscriptionOperationKey(8, 'autodial', null))
      .toBe('subscription:8:autodial:initial');
  });
});
