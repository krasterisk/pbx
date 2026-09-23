import { PlatformPricesController } from './platform-prices.controller';

describe('PlatformPricesController', () => {
  it('delegates SuperAdmin list and patch to the facade', async () => {
    const prices = {
      list: jest.fn().mockResolvedValue({ subscriptions: [], aiSkus: [], usageRates: [] }),
      patchSubscription: jest.fn().mockResolvedValue({ code: 'autodial', amount: 10 }),
      patchAiSku: jest.fn().mockResolvedValue({ skuCode: 'sa-basic', revision: 2 }),
      insertUsageRate: jest.fn().mockResolvedValue({ unit: 'audio_ms' }),
    };
    const controller = new PlatformPricesController(prices as any);
    await expect(controller.list()).resolves.toEqual({ subscriptions: [], aiSkus: [], usageRates: [] });
    await controller.patchSubscription('autodial', { amount: 10, period: 'hour' });
    expect(prices.patchSubscription).toHaveBeenCalledWith('autodial', { amount: 10, period: 'hour' });
    await controller.patchAiSku({ ownerTenantUid: 1, skuCode: 'sa-basic', priceMonthlyMinor: 100 });
    await controller.insertUsageRate({
      product: 'speech_analytics', unit: 'audio_ms', rate: 0.02, moneyPolicy: 'shadow',
    });
    expect(prices.insertUsageRate).toHaveBeenCalled();
  });
});
