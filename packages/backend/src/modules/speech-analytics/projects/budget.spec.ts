import {
  evaluateBudgetSoftLimit,
  sumSaChargeRunAmounts,
} from './budget';

describe('SA project soft budget (D-28)', () => {
  const period = {
    from: new Date('2026-09-01T00:00:00Z'),
    to: new Date('2026-09-30T23:59:59Z'),
  };

  it('sums all SA-CHARGE-RUN amounts in the period and ignores out-of-range rows', () => {
    const total = sumSaChargeRunAmounts(
      [
        { amount: '10.50', currency: 'RUB', createdAt: '2026-09-05T12:00:00Z' },
        { amount: '2.25', currency: 'RUB', createdAt: '2026-09-10T12:00:00Z' },
        { amount: '99.00', currency: 'RUB', createdAt: '2026-08-01T12:00:00Z' },
        { amount: '1.00', currency: 'USD', createdAt: '2026-09-12T12:00:00Z' },
        { amount: null, currency: 'RUB', createdAt: '2026-09-15T12:00:00Z' },
      ],
      period,
      'RUB',
    );
    expect(total).toBe('12.75');
  });

  it('treats softLimit 0 as no limit and never stops analyses when exceeded', () => {
    const none = evaluateBudgetSoftLimit({ softLimit: 0, spent: '999.00' });
    expect(none.exceeded).toBe(false);
    expect(none.shouldAlert).toBe(false);
    expect(none.shouldWebhook).toBe(false);
    expect(none.stopAnalyses).toBe(false);

    const over = evaluateBudgetSoftLimit({ softLimit: 10, spent: '12.75' });
    expect(over.exceeded).toBe(true);
    expect(over.shouldAlert).toBe(true);
    expect(over.shouldWebhook).toBe(true);
    expect(over.stopAnalyses).toBe(false);
  });
});
