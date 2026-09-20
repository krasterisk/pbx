import {
  emptyUsageStores, insertPrice, reserveJobBudget, seedQuota, utcMonthStart,
} from './usage-engine';
import { createEmulatedWallet } from './emulated-wallet';
import { createDraftSku, emptySkuStores } from './sku-catalog';
import {
  BILLABLE_FIXTURE_GATE, DEFAULT_CLOUD_WALLET_GATE, FIXTURE_TENANT_UID,
  assertCloudWalletDisabled, assertNoLiveTenantDebit, billingChargeFromEmulated,
  cloudWalletLive, disabledWallet, guardedBillingCharge, readCloudWalletGate,
  reconcileShadowToBillable, settleShadow, settleUsage,
} from './shadow-settlement';

const now = new Date('2026-09-20T12:00:00.000Z');
const later = new Date('2026-09-20T12:05:00.000Z');
const jobId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const LIVE_TENANTS = [1, 7] as const;

function seeded(policy: 'shadow' | 'local_byok' | 'cloud_wallet' = 'cloud_wallet') {
  const stores = emptyUsageStores();
  seedQuota(stores, {
    tenantUid: FIXTURE_TENANT_UID, product: 'speech_analytics', metric: 'audio_ms',
    periodStart: utcMonthStart(now), limitUnits: 20,
  });
  insertPrice(stores, {
    id: `price-${policy}`,
    providerUid: policy === 'local_byok' ? 'local' : 'test',
    product: 'speech_analytics',
    unit: 'audio_ms',
    currency: policy === 'local_byok' ? null : 'RUB',
    rate: policy === 'local_byok' ? null : '1.25',
    scale: 2,
    roundingMode: 'half_up',
    moneyPolicy: policy,
    configDigest: (policy === 'local_byok' ? 'bb' : 'aa').repeat(32),
  });
  return stores;
}

function hold(stores: ReturnType<typeof emptyUsageStores>, units = 4) {
  return reserveJobBudget(stores, {
    tenantUid: FIXTURE_TENANT_UID, jobId, product: 'speech_analytics', metric: 'audio_ms',
    units, now, expiresAt: later,
  });
}

describe('COM2 billable switch', () => {
  it('keeps default shadow and requires both installation and tenant flags', () => {
    expect(cloudWalletLive()).toBe(false);
    expect(cloudWalletLive({ installationFlag: true, tenantFlag: false })).toBe(false);
    expect(cloudWalletLive({ installationFlag: false, tenantFlag: true })).toBe(false);
    expect(cloudWalletLive(BILLABLE_FIXTURE_GATE)).toBe(true);
    expect(() => assertCloudWalletDisabled('cloud_wallet')).toThrow(/disabled/);
    expect(() => assertCloudWalletDisabled('cloud_wallet', BILLABLE_FIXTURE_GATE)).not.toThrow();
    expect(readCloudWalletGate({ AI_CLOUD_WALLET: '1' }, FIXTURE_TENANT_UID)).toEqual({
      installationFlag: true, tenantFlag: false,
    });
    expect(readCloudWalletGate({
      AI_CLOUD_WALLET: '1', AI_CLOUD_WALLET_TENANTS: '8',
    }, FIXTURE_TENANT_UID)).toEqual(BILLABLE_FIXTURE_GATE);
  });

  it('settles shadow without a wallet debit', async () => {
    const stores = seeded('shadow');
    const held = hold(stores);
    const quota = [...stores.quotas.values()][0];
    expect(quota.reservedUnits).toBe(4);
    const wallet = disabledWallet();
    const result = await settleUsage({
      stores, reservationId: held.id, tenantUid: FIXTURE_TENANT_UID, actualUnits: 4,
      price: stores.prices.get('price-shadow')!, wallet, gate: DEFAULT_CLOUD_WALLET_GATE,
    });
    expect(result).toEqual({ charged: false, amount: '5.00', replay: false });
    expect(wallet.chargeCalls).toBe(0);
    expect(quota.usedUnits).toBe(4);
  });

  it('refuses cloud_wallet until both flags are on', async () => {
    const stores = seeded();
    const held = hold(stores);
    await expect(settleUsage({
      stores, reservationId: held.id, tenantUid: FIXTURE_TENANT_UID, actualUnits: 4,
      price: stores.prices.get('price-cloud_wallet')!, wallet: disabledWallet(),
      gate: { installationFlag: true, tenantFlag: false },
    })).rejects.toThrow(/disabled/);
    expect(stores.reservations.get(held.id)?.state).toBe('held');
  });

  it('charges the wallet before committing quota and debits once per reservation', async () => {
    const stores = seeded();
    const held = hold(stores);
    const quota = [...stores.quotas.values()][0];
    const reserved = quota.reservedUnits;
    const emu = createEmulatedWallet(10_000);
    const wallet = disabledWallet();
    const billingCharge = guardedBillingCharge(billingChargeFromEmulated(emu), LIVE_TENANTS);
    const first = await settleUsage({
      stores, reservationId: held.id, tenantUid: FIXTURE_TENANT_UID, actualUnits: 4,
      price: stores.prices.get('price-cloud_wallet')!, wallet, gate: BILLABLE_FIXTURE_GATE,
      billingCharge,
    });
    expect(first).toEqual({ charged: true, amount: '5.00', replay: false });
    expect(emu.charges).toHaveLength(1);
    expect(emu.charges[0]).toMatchObject({
      tenantUid: FIXTURE_TENANT_UID, operationKey: `ai-usage:${held.id}`, amountKopecks: 500,
    });
    expect(emu.balanceKopecks).toBe(9500);
    expect(quota.usedUnits).toBe(4);
    expect(quota.reservedUnits).toBe(reserved - 4);
    expect(wallet.chargeCalls).toBe(0);
    expect(wallet.lookupCalls).toBe(0);
    const replay = await settleUsage({
      stores, reservationId: held.id, tenantUid: FIXTURE_TENANT_UID, actualUnits: 4,
      price: stores.prices.get('price-cloud_wallet')!, wallet, gate: BILLABLE_FIXTURE_GATE,
      billingCharge,
    });
    expect(replay.replay).toBe(true);
    expect(replay.charged).toBe(false);
    expect(emu.charges).toHaveLength(1);
    expect(emu.balanceKopecks).toBe(9500);
    expect(stores.ledger.filter((row) => row.entryKind === 'settle')).toHaveLength(1);
    assertNoLiveTenantDebit(emu.charges, LIVE_TENANTS);
  });

  it('serializes a concurrent settle race into one ledger row and one debit', async () => {
    const stores = seeded();
    const held = hold(stores);
    const emu = createEmulatedWallet(10_000);
    const billingCharge = guardedBillingCharge(billingChargeFromEmulated(emu), LIVE_TENANTS);
    const price = stores.prices.get('price-cloud_wallet')!;
    const wallet = disabledWallet();
    const [a, b] = await Promise.all([
      settleUsage({
        stores, reservationId: held.id, tenantUid: FIXTURE_TENANT_UID, actualUnits: 4,
        price, wallet, gate: BILLABLE_FIXTURE_GATE, billingCharge,
      }),
      settleUsage({
        stores, reservationId: held.id, tenantUid: FIXTURE_TENANT_UID, actualUnits: 4,
        price, wallet, gate: BILLABLE_FIXTURE_GATE, billingCharge,
      }),
    ]);
    expect([a.charged, b.charged].filter(Boolean)).toHaveLength(1);
    expect(emu.charges).toHaveLength(1);
    expect(stores.ledger.filter((row) => row.entryKind === 'settle')).toHaveLength(1);
  });

  it('does not look up or charge a wallet on local_byok even with live flags', async () => {
    const stores = seeded('local_byok');
    const held = hold(stores, 2);
    const wallet = disabledWallet();
    const emu = createEmulatedWallet();
    const result = await settleUsage({
      stores, reservationId: held.id, tenantUid: FIXTURE_TENANT_UID, actualUnits: 2,
      price: stores.prices.get('price-local_byok')!, wallet, gate: BILLABLE_FIXTURE_GATE,
      billingCharge: billingChargeFromEmulated(emu),
    });
    expect(result.charged).toBe(false);
    expect(result.amount).toBeNull();
    expect(wallet.lookupCalls).toBe(0);
    expect(emu.charges).toHaveLength(0);
  });

  it('keeps quota held when the wallet charge fails', async () => {
    const stores = seeded();
    const held = hold(stores);
    const quota = [...stores.quotas.values()][0];
    const emu = createEmulatedWallet(1);
    await expect(settleUsage({
      stores, reservationId: held.id, tenantUid: FIXTURE_TENANT_UID, actualUnits: 4,
      price: stores.prices.get('price-cloud_wallet')!, wallet: disabledWallet(),
      gate: BILLABLE_FIXTURE_GATE, billingCharge: billingChargeFromEmulated(emu),
    })).rejects.toThrow(/insufficient_funds/);
    expect(stores.reservations.get(held.id)?.state).toBe('held');
    expect(quota.usedUnits).toBe(0);
    expect(quota.reservedUnits).toBe(4);
    expect(emu.charges).toHaveLength(0);
  });

  it('does not debit held or unknown reservations during shadow-to-billable reconcile', async () => {
    const stores = seeded();
    const held = hold(stores, 1);
    const emu = createEmulatedWallet();
    const heldResult = await reconcileShadowToBillable({
      stores, reservationId: held.id, tenantUid: FIXTURE_TENANT_UID,
      price: stores.prices.get('price-cloud_wallet')!, gate: BILLABLE_FIXTURE_GATE,
      billingCharge: billingChargeFromEmulated(emu),
    });
    expect(heldResult).toEqual({ charged: false, replay: false, amount: null, held: true });
    expect(emu.charges).toHaveLength(0);
    const shadowPrice = insertPrice(stores, {
      ...stores.prices.get('price-cloud_wallet')!,
      id: 'price-shadow',
      moneyPolicy: 'shadow',
    });
    settleShadow({
      stores, reservationId: held.id, tenantUid: FIXTURE_TENANT_UID, actualUnits: 1,
      price: shadowPrice, wallet: disabledWallet(),
    });
    const first = await reconcileShadowToBillable({
      stores, reservationId: held.id, tenantUid: FIXTURE_TENANT_UID,
      price: stores.prices.get('price-cloud_wallet')!, gate: BILLABLE_FIXTURE_GATE,
      billingCharge: guardedBillingCharge(billingChargeFromEmulated(emu), LIVE_TENANTS),
    });
    expect(first.charged).toBe(true);
    expect(first.held).toBe(false);
    const second = await reconcileShadowToBillable({
      stores, reservationId: held.id, tenantUid: FIXTURE_TENANT_UID,
      price: stores.prices.get('price-cloud_wallet')!, gate: BILLABLE_FIXTURE_GATE,
      billingCharge: guardedBillingCharge(billingChargeFromEmulated(emu), LIVE_TENANTS),
    });
    expect(second.replay).toBe(true);
    expect(emu.charges).toHaveLength(1);
    expect(stores.ledger.filter((row) => row.entryKind === 'settle')).toHaveLength(1);
  });

  it('rejects live-tenant debit and keeps SKU create off cloud_wallet', () => {
    expect(() => assertNoLiveTenantDebit([{ tenantUid: 1 }], LIVE_TENANTS)).toThrow(/live_tenant_debit_forbidden/);
    expect(() => assertNoLiveTenantDebit([{ tenantUid: FIXTURE_TENANT_UID }], LIVE_TENANTS)).not.toThrow();
    expect(() => createDraftSku(emptySkuStores(), {
      ownerTenantUid: FIXTURE_TENANT_UID, skuCode: 'speech_analytics', product: 'speech_analytics',
      moneyPolicy: 'cloud_wallet', priceMonthlyMinor: 100, currency: 'RUB',
      trialDays: 0, limits: {
        concurrent_jobs: 1, concurrent_sessions: 1, storage_bytes: 1, audio_ms: 1, provider_tokens: 1,
      }, now,
    })).toThrow(/sku_money_policy_invalid/);
  });
});
