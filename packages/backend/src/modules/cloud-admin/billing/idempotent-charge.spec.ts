import { decideCharge, purchaseChargeOperationKey, subscriptionChargeOperationKey, usageChargeOperationKey } from './idempotent-charge';

describe('live BillingBalanceService.charge idempotency', () => {
  it('replays the same operation key instead of a second debit', () => {
    expect(decideCharge({
      existing: false, balanceKopecks: 10_000, creditLimitKopecks: 0, amountKopecks: 250,
    })).toEqual({ kind: 'debit', balanceAfter: 9750, blocked: false });
    expect(decideCharge({
      existing: true, balanceKopecks: 9750, creditLimitKopecks: 0, amountKopecks: 250,
    })).toEqual({ kind: 'replay' });
    expect(usageChargeOperationKey('res-1')).toBe('ai-usage:res-1');
    expect(purchaseChargeOperationKey(8, 'speech_analytics')).toBe('purchase:8:speech_analytics');
    expect(subscriptionChargeOperationKey(8, '2026-09')).toBe('subscription:8:2026-09');
  });
});
