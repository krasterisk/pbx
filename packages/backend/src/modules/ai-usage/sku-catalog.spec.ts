import { emptyUsageStores, insertPrice, reserveJobBudget, utcMonthStart } from './usage-engine';
import { disabledWallet } from './shadow-settlement';
import {
  createDraftSku, emptySkuStores, enableSkuProduct, listPublishedSkus,
  processingAdmission, publishSku, purchaseSku, reviseSkuPrice, revokeSku,
} from './sku-catalog';

const now = new Date('2026-09-20T12:00:00.000Z');
const later = new Date('2026-09-20T12:05:00.000Z');
const limits = {
  concurrent_jobs: 2, concurrent_sessions: 1, storage_bytes: 1000,
  audio_ms: 10, provider_tokens: 50,
};

function published(owner = 8, code = 'speech_analytics') {
  const stores = emptySkuStores();
  createDraftSku(stores, {
    ownerTenantUid: owner, skuCode: code, product: 'speech_analytics',
    moneyPolicy: 'shadow', priceMonthlyMinor: 0, currency: 'RUB',
    trialDays: 14, limits, now,
  });
  publishSku(stores, owner, code);
  return stores;
}

describe('COM1 SKU catalog and trial snapshots', () => {
  it('denies unpublished, draft and revoked SKUs even via direct purchase', () => {
    const stores = emptySkuStores();
    createDraftSku(stores, {
      ownerTenantUid: 8, skuCode: 'speech_analytics', product: 'speech_analytics',
      moneyPolicy: 'shadow', priceMonthlyMinor: 100, currency: 'RUB',
      trialDays: 7, limits, now,
    });
    expect(() => purchaseSku(stores, {
      buyerUid: 8, ownerTenantUid: 8, skuCode: 'speech_analytics', now,
    })).toThrow(/OFFER_NOT_RELEASED/);
    publishSku(stores, 8, 'speech_analytics');
    revokeSku(stores, 8, 'speech_analytics');
    expect(() => purchaseSku(stores, {
      buyerUid: 8, ownerTenantUid: 8, skuCode: 'speech_analytics', now,
    })).toThrow(/OFFER_NOT_RELEASED/);
    expect(listPublishedSkus(stores, 8)).toEqual([]);
  });

  it('keeps enable and processing off until a purchase exists', () => {
    const stores = published();
    expect(processingAdmission(stores, {
      tenantUid: 8, product: 'speech_analytics', now,
    }).reason).toBe('not_entitled');
    expect(() => enableSkuProduct(stores, {
      tenantUid: 8, product: 'speech_analytics', enabled: true, now,
    })).toThrow(/not_entitled/);
    purchaseSku(stores, { buyerUid: 8, ownerTenantUid: 8, skuCode: 'speech_analytics', now });
    expect(processingAdmission(stores, {
      tenantUid: 8, product: 'speech_analytics', now,
    }).reason).toBe('product_disabled');
    expect(stores.activations.get('8:speech_analytics')).toBeUndefined();
    enableSkuProduct(stores, { tenantUid: 8, product: 'speech_analytics', enabled: true, now });
    expect(processingAdmission(stores, {
      tenantUid: 8, product: 'speech_analytics', now,
    }).allowed).toBe(true);
  });

  it('enforces trial limits on the server quota counters, not only in UI', () => {
    const stores = published();
    purchaseSku(stores, { buyerUid: 8, ownerTenantUid: 8, skuCode: 'speech_analytics', now });
    enableSkuProduct(stores, { tenantUid: 8, product: 'speech_analytics', enabled: true, now });
    const usage = emptyUsageStores();
    usage.quotas = stores.quotas;
    usage.prices = stores.prices;
    reserveJobBudget(usage, {
      tenantUid: 8, jobId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      product: 'speech_analytics', metric: 'audio_ms', units: 10, now, expiresAt: later,
    });
    expect(() => reserveJobBudget(usage, {
      tenantUid: 8, jobId: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
      product: 'speech_analytics', metric: 'audio_ms', units: 1, now, expiresAt: later,
    })).toThrow(/exhausted/);
  });

  it('does not debit a wallet on the BYOK path', () => {
    const stores = emptySkuStores();
    createDraftSku(stores, {
      ownerTenantUid: 8, skuCode: 'speech_analytics', product: 'speech_analytics',
      moneyPolicy: 'local_byok', priceMonthlyMinor: 0, currency: null,
      trialDays: 0, limits, now,
    });
    publishSku(stores, 8, 'speech_analytics');
    const wallet = disabledWallet();
    purchaseSku(stores, {
      buyerUid: 8, ownerTenantUid: 8, skuCode: 'speech_analytics', now, wallet,
    });
    expect(wallet.chargeCalls).toBe(0);
    expect(wallet.lookupCalls).toBe(0);
    const price = [...stores.prices.values()][0];
    expect(price.rate).toBeNull();
    expect(price.moneyPolicy).toBe('local_byok');
  });

  it('hides tenant B from tenant A catalog and purchase', () => {
    const stores = published(8, 'speech_analytics');
    createDraftSku(stores, {
      ownerTenantUid: 9, skuCode: 'speech_analytics', product: 'speech_analytics',
      moneyPolicy: 'shadow', priceMonthlyMinor: 1, currency: 'RUB',
      trialDays: 1, limits, now,
    });
    publishSku(stores, 9, 'speech_analytics');
    expect(listPublishedSkus(stores, 8).map((row) => row.ownerTenantUid)).toEqual([8]);
    expect(() => purchaseSku(stores, {
      buyerUid: 8, ownerTenantUid: 9, skuCode: 'speech_analytics', now,
    })).toThrow(/offer_tenant_denied/);
    expect(stores.entitlements.size).toBe(0);
  });

  it('does not let a concurrent enable bypass unpublished purchase', () => {
    const stores = emptySkuStores();
    createDraftSku(stores, {
      ownerTenantUid: 8, skuCode: 'speech_analytics', product: 'speech_analytics',
      moneyPolicy: 'shadow', priceMonthlyMinor: 100, currency: 'RUB',
      trialDays: 1, limits, now,
    });
    const attempts = [
      () => purchaseSku(stores, {
        buyerUid: 8, ownerTenantUid: 8, skuCode: 'speech_analytics', now,
      }),
      () => enableSkuProduct(stores, {
        tenantUid: 8, product: 'speech_analytics', enabled: true, now,
      }),
    ];
    const codes = attempts.map((run) => {
      try { run(); return 'ok'; } catch (error) { return (error as { code?: string }).code; }
    });
    expect(codes.sort()).toEqual(['OFFER_NOT_RELEASED', 'not_entitled']);
    expect(processingAdmission(stores, {
      tenantUid: 8, product: 'speech_analytics', now,
    }).allowed).toBe(false);
  });

  it('stops processing when a trial entitlement expires and keeps the rows', () => {
    const stores = published();
    purchaseSku(stores, { buyerUid: 8, ownerTenantUid: 8, skuCode: 'speech_analytics', now });
    enableSkuProduct(stores, { tenantUid: 8, product: 'speech_analytics', enabled: true, now });
    const expiredAt = new Date('2026-10-05T12:00:00.000Z');
    expect(processingAdmission(stores, {
      tenantUid: 8, product: 'speech_analytics', now: expiredAt,
    })).toMatchObject({ allowed: false, reason: 'entitlement_expired' });
    expect(stores.entitlements.get('8:speech_analytics')?.status).toBe('expired');
    expect(stores.quotas.size).toBeGreaterThan(0);
  });

  it('inserts a new immutable revision on price edit and keeps purchased snapshots', () => {
    const stores = published();
    const first = stores.offers.get('8:speech_analytics')!.currentRevisionId;
    purchaseSku(stores, { buyerUid: 8, ownerTenantUid: 8, skuCode: 'speech_analytics', now });
    const next = reviseSkuPrice(stores, {
      ownerTenantUid: 8, skuCode: 'speech_analytics', priceMonthlyMinor: 400000,
      currency: 'RUB', trialDays: 14, limits,
    });
    expect(next.id).not.toBe(first);
    expect(next.revision).toBe(2);
    expect(stores.revisions.get(first)?.priceMonthlyMinor).toBe(0);
    expect(stores.entitlements.get('8:speech_analytics')?.skuRevisionId).toBe(first);
    expect(utcMonthStart(now)).toContain('2026-09');
    insertPrice({
      quotas: stores.quotas, reservations: new Map(), events: new Map(),
      ledger: [], prices: stores.prices,
    }, {
      id: 'price-kept', providerUid: 'saas', product: 'speech_analytics', unit: 'audio_ms',
      currency: 'RUB', rate: '1.00', scale: 2, roundingMode: 'half_up',
      moneyPolicy: 'shadow', configDigest: 'cc'.repeat(32),
    });
    expect(stores.prices.get('price-kept')?.rate).toBe('1.00');
  });

  it('charges the SaaS wallet once for a priced shadow SKU and not for metering', () => {
    const stores = emptySkuStores();
    createDraftSku(stores, {
      ownerTenantUid: 8, skuCode: 'speech_analytics', product: 'speech_analytics',
      moneyPolicy: 'shadow', priceMonthlyMinor: 250000, currency: 'RUB',
      trialDays: 0, limits, now,
    });
    publishSku(stores, 8, 'speech_analytics');
    const wallet = disabledWallet();
    wallet.charge = function charge() { this.chargeCalls += 1; };
    purchaseSku(stores, {
      buyerUid: 8, ownerTenantUid: 8, skuCode: 'speech_analytics', now, wallet,
    });
    expect(wallet.chargeCalls).toBe(1);
    expect(wallet.lookupCalls).toBe(0);
  });
});
