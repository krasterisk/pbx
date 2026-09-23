import { PlatformPricesService } from './platform-prices.service';

describe('PlatformPricesService', () => {
  const autodial = {
    code: 'autodial',
    name: 'Автообзвон',
    category: 'calls',
    is_core: false,
    is_paid: true,
    is_published: true,
    price_amount: 3500,
    price_monthly: 3500,
    billing_period: 'month',
    billing_interval_count: 1,
    update: jest.fn(async function update(this: any, patch: object) {
      Object.assign(this, patch);
    }),
  };

  it('lists registry rows plus SKU and usage facades', async () => {
    const skuCatalog = {
      listAllOffers: jest.fn().mockResolvedValue([{ skuCode: 'sa-basic', product: 'speech_analytics' }]),
      listLatestUsageRates: jest.fn().mockResolvedValue([{ product: 'speech_analytics', unit: 'audio_ms', rate: 0.01 }]),
    };
    const service = new PlatformPricesService(
      { findAll: jest.fn().mockResolvedValue([autodial]) } as any,
      skuCatalog as any,
    );
    const listed = await service.list();
    expect(listed.subscriptions[0]).toMatchObject({
      code: 'autodial', amount: 3500, period: 'month', intervalCount: 1,
    });
    expect(listed.aiSkus).toHaveLength(1);
    expect(listed.usageRates[0].unit).toBe('audio_ms');
  });

  it('patches amount/period and syncs price_monthly only for month×1', async () => {
    const service = new PlatformPricesService(
      { findOne: jest.fn().mockResolvedValue(autodial) } as any,
      {} as any,
    );
    const day = await service.patchSubscription('autodial', {
      amount: 120, period: 'day', intervalCount: 1,
    });
    expect(day).toMatchObject({ amount: 120, period: 'day' });
    expect(autodial.update).toHaveBeenCalledWith(expect.not.objectContaining({ price_monthly: 120 }));

    autodial.price_amount = 3500;
    autodial.billing_period = 'month';
    const month = await service.patchSubscription('autodial', {
      amount: 4000, period: 'month', intervalCount: 1,
    });
    expect(month.amount).toBe(4000);
    expect(autodial.update).toHaveBeenLastCalledWith(expect.objectContaining({
      price_amount: 4000, price_monthly: 4000, billing_period: 'month',
    }));
  });
});
