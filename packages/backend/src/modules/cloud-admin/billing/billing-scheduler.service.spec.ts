import { BillingSchedulerService } from './billing-scheduler.service';

describe('BillingSchedulerService period charges', () => {
  const now = new Date('2026-02-01T03:00:00.000Z');

  function build(overrides?: {
    lastBilledAt?: Date | null;
    period?: string;
    amount?: number;
    cycle?: string;
  }) {
    const tm = {
      module_code: 'autodial',
      billing_period: overrides?.period ?? 'month',
      billing_interval_count: 1,
      billing_cycle: overrides?.cycle ?? 'monthly',
      last_billed_at: overrides?.lastBilledAt === undefined
        ? new Date('2026-01-01T03:00:00.000Z')
        : overrides.lastBilledAt,
      list_price_amount: overrides?.amount ?? 3500,
      update: jest.fn().mockResolvedValue(undefined),
    };
    const charge = jest.fn().mockResolvedValue({ replay: false });
    const service = new BillingSchedulerService(
      {} as any,
      { findAll: jest.fn().mockResolvedValue([{ id: 8, name: 'Acme', status: 'active' }]) } as any,
      { findAll: jest.fn().mockResolvedValue([tm]) } as any,
      { findAll: jest.fn().mockResolvedValue([{ code: 'autodial', name: 'Автообзвон', price_amount: 3500, price_monthly: 3500 }]) } as any,
      { charge } as any,
    );
    jest.useFakeTimers().setSystemTime(now);
    return { service, charge, tm };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('charges a due monthly snapshot and advances last_billed_at', async () => {
    const { service, charge, tm } = build();
    await service.chargeDueSubscriptions();
    expect(charge).toHaveBeenCalledWith(
      8,
      3500,
      0,
      expect.stringContaining('autodial'),
      'autodial',
      'charge',
      'subscription:8:autodial:2026-01-01T03:00:00.000Z',
    );
    expect(tm.update).toHaveBeenCalledWith({ last_billed_at: now });
  });

  it('skips lifetime and zero-price rows', async () => {
    const lifetime = build({ period: 'lifetime', amount: 1500 });
    await lifetime.service.chargeDueSubscriptions();
    expect(lifetime.charge).not.toHaveBeenCalled();

    const free = build({ amount: 0 });
    await free.service.chargeDueSubscriptions();
    expect(free.charge).not.toHaveBeenCalled();
  });

  it('does not charge when the period has not elapsed', async () => {
    const { service, charge } = build({ lastBilledAt: now, period: 'hour' });
    await service.chargeDueSubscriptions();
    expect(charge).not.toHaveBeenCalled();
  });
});
