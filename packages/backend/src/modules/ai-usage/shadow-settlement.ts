import { multiplyUnitsByRate } from './money';
import type { MoneyPolicy, PriceRow, ReservationRow, UsageStores } from './usage-engine';
import { settleReservation } from './usage-engine';
import { usageChargeOperationKey } from '../cloud-admin/billing/idempotent-charge';
import { amountToKopecks } from './emulated-wallet';

export const FIXTURE_TENANT_UID = 8;

export type WalletProbe = {
  chargeCalls: number;
  lookupCalls: number;
  charge: () => void;
  lookupBalance: () => number;
};

export type CloudWalletGate = {
  installationFlag: boolean;
  tenantFlag: boolean;
};

export const DEFAULT_CLOUD_WALLET_GATE: CloudWalletGate = {
  installationFlag: false,
  tenantFlag: false,
};

export const BILLABLE_FIXTURE_GATE: CloudWalletGate = {
  installationFlag: true,
  tenantFlag: true,
};

export type BillingChargeFn = (input: {
  operationKey: string;
  amountDecimal: string;
  tenantUid: number;
}) => { replay: boolean } | Promise<{ replay: boolean }>;

const settleLocks = new Map<string, Promise<unknown>>();

async function withReservationSettleLock<T>(reservationId: string, work: () => Promise<T>): Promise<T> {
  const previous = settleLocks.get(reservationId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current, () => current);
  settleLocks.set(reservationId, chained);
  await previous.then(() => undefined, () => undefined);
  try {
    return await work();
  } finally {
    release();
    if (settleLocks.get(reservationId) === chained) settleLocks.delete(reservationId);
  }
}

export function disabledWallet(): WalletProbe {
  return {
    chargeCalls: 0,
    lookupCalls: 0,
    charge() {
      this.chargeCalls += 1;
      throw new Error('live wallet charge is not allowed in AI-02 shadow settlement');
    },
    lookupBalance() {
      this.lookupCalls += 1;
      return 0;
    },
  };
}

export function readCloudWalletGate(
  env: NodeJS.Dict<string> = process.env,
  tenant: boolean | number = false,
): CloudWalletGate {
  const tenants = (env.AI_CLOUD_WALLET_TENANTS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    installationFlag: env.AI_CLOUD_WALLET === '1',
    tenantFlag: typeof tenant === 'boolean' ? tenant : tenants.includes(String(tenant)),
  };
}

export function cloudWalletLive(gate: CloudWalletGate = DEFAULT_CLOUD_WALLET_GATE): boolean {
  return gate.installationFlag === true && gate.tenantFlag === true;
}

export function assertCloudWalletDisabled(
  policy: MoneyPolicy,
  gate: CloudWalletGate = DEFAULT_CLOUD_WALLET_GATE,
): void {
  if (policy === 'cloud_wallet' && !cloudWalletLive(gate)) {
    throw Object.assign(new Error('cloud_wallet processing is disabled until AI-10'), {
      code: 'cloud_wallet_disabled',
    });
  }
}

function requireReservation(stores: UsageStores, reservationId: string, tenantUid: number): ReservationRow {
  const row = stores.reservations.get(reservationId);
  if (!row || row.tenantUid !== tenantUid) {
    throw Object.assign(new Error('reservation missing'), { code: 'reservation_missing' });
  }
  return row;
}

function ledgerSettleAmount(stores: UsageStores, reservationId: string): string | null {
  const settle = [...stores.ledger].reverse().find((item) =>
    item.reservationId === reservationId && item.entryKind === 'settle');
  return settle?.amountDecimal ?? null;
}

function settleCount(stores: UsageStores, reservationId: string): number {
  return stores.ledger.filter((item) =>
    item.reservationId === reservationId && item.entryKind === 'settle').length;
}

export function settleShadow(input: {
  stores: UsageStores;
  reservationId: string;
  tenantUid: number;
  actualUnits: number;
  price: PriceRow;
  wallet: WalletProbe;
}): { charged: false; amount: string | null } {
  assertCloudWalletDisabled(input.price.moneyPolicy);
  if (input.price.moneyPolicy === 'local_byok') {
    if (input.price.rate != null && Number(input.price.rate) === 0) {
      throw Object.assign(new Error('BYOK unknown rate must be null'), { code: 'price_unknown_zero' });
    }
  }
  settleReservation(input.stores, {
    id: input.reservationId,
    tenantUid: input.tenantUid,
    actualUnits: input.actualUnits,
    priceRevisionId: input.price.id,
    eventKey: 'settle',
  });
  if (input.wallet.chargeCalls !== 0 || input.wallet.lookupCalls !== 0) {
    throw new Error('shadow settlement must not touch the live wallet');
  }
  const last = input.stores.ledger[input.stores.ledger.length - 1];
  return { charged: false, amount: last?.amountDecimal ?? null };
}

export async function settleUsage(input: {
  stores: UsageStores;
  reservationId: string;
  tenantUid: number;
  actualUnits: number;
  price: PriceRow;
  wallet: WalletProbe;
  gate?: CloudWalletGate;
  billingCharge?: BillingChargeFn;
}): Promise<{ charged: boolean; amount: string | null; replay: boolean }> {
  return withReservationSettleLock(input.reservationId, async () => {
    const gate = input.gate ?? DEFAULT_CLOUD_WALLET_GATE;
    const billable = input.price.moneyPolicy === 'cloud_wallet' && cloudWalletLive(gate);
    if (!billable) {
      const shadow = settleShadow({
        stores: input.stores,
        reservationId: input.reservationId,
        tenantUid: input.tenantUid,
        actualUnits: input.actualUnits,
        price: input.price,
        wallet: input.wallet,
      });
      return { charged: false, amount: shadow.amount, replay: false };
    }
    if (input.price.moneyPolicy === 'local_byok') {
      throw Object.assign(new Error('byok_wallet_forbidden'), { code: 'byok_wallet_forbidden' });
    }
    if (input.wallet.lookupCalls !== 0) {
      throw new Error('billable settlement must not look up wallet balance before charge');
    }
    if (!input.billingCharge) {
      throw Object.assign(new Error('billable_charge_required'), { code: 'billable_charge_required' });
    }
    if (input.price.rate == null) {
      throw Object.assign(new Error('price_rate_missing'), { code: 'price_rate_missing' });
    }
    const row = requireReservation(input.stores, input.reservationId, input.tenantUid);
    const alreadySettled = row.state === 'settled' || row.state === 'overage';
    const amount = alreadySettled
      ? (ledgerSettleAmount(input.stores, input.reservationId)
        ?? multiplyUnitsByRate(BigInt(row.settledUnits), input.price.rate, input.price.scale))
      : multiplyUnitsByRate(BigInt(input.actualUnits), input.price.rate, input.price.scale);
    const billed = await Promise.resolve(input.billingCharge({
      operationKey: usageChargeOperationKey(input.reservationId),
      amountDecimal: amount,
      tenantUid: input.tenantUid,
    }));
    if (!alreadySettled) {
      settleReservation(input.stores, {
        id: input.reservationId,
        tenantUid: input.tenantUid,
        actualUnits: input.actualUnits,
        priceRevisionId: input.price.id,
        eventKey: 'settle',
      });
    }
    if (settleCount(input.stores, input.reservationId) !== 1) {
      throw Object.assign(new Error('duplicate settle ledger'), { code: 'ledger_duplicate' });
    }
    return { charged: !billed.replay && !alreadySettled, amount, replay: billed.replay || alreadySettled };
  });
}

export async function reconcileShadowToBillable(input: {
  stores: UsageStores;
  reservationId: string;
  tenantUid: number;
  price: PriceRow;
  gate: CloudWalletGate;
  billingCharge: BillingChargeFn;
}): Promise<{ charged: boolean; replay: boolean; amount: string | null; held: boolean }> {
  if (!cloudWalletLive(input.gate)) {
    assertCloudWalletDisabled('cloud_wallet', input.gate);
  }
  const row = requireReservation(input.stores, input.reservationId, input.tenantUid);
  if (row.state !== 'settled' && row.state !== 'overage') {
    return { charged: false, replay: false, amount: null, held: true };
  }
  const amount = ledgerSettleAmount(input.stores, input.reservationId)
    ?? (input.price.rate != null
      ? multiplyUnitsByRate(BigInt(row.settledUnits), input.price.rate, input.price.scale)
      : null);
  if (amount == null) {
    return { charged: false, replay: false, amount: null, held: false };
  }
  const billed = await Promise.resolve(input.billingCharge({
    operationKey: usageChargeOperationKey(input.reservationId),
    amountDecimal: amount,
    tenantUid: input.tenantUid,
  }));
  if (settleCount(input.stores, input.reservationId) !== 1) {
    throw Object.assign(new Error('reconcile must not settle again'), { code: 'ledger_duplicate' });
  }
  return { charged: !billed.replay, replay: billed.replay, amount, held: false };
}

export function assertNoLiveTenantDebit(
  charges: Array<{ tenantUid: number }>,
  liveTenantUids: readonly number[],
): void {
  for (const charge of charges) {
    if (liveTenantUids.includes(charge.tenantUid)) {
      throw Object.assign(new Error('live_tenant_debit_forbidden'), { code: 'live_tenant_debit_forbidden' });
    }
  }
}

export function guardedBillingCharge(
  inner: BillingChargeFn,
  liveTenantUids: readonly number[],
): BillingChargeFn {
  return async (input) => {
    assertNoLiveTenantDebit([input], liveTenantUids);
    return inner(input);
  };
}

export function billingChargeFromEmulated(wallet: {
  charge(input: { tenantUid: number; operationKey: string; amountKopecks: number }): { replay: boolean };
}): BillingChargeFn {
  return (input) => wallet.charge({
    tenantUid: input.tenantUid,
    operationKey: input.operationKey,
    amountKopecks: amountToKopecks(input.amountDecimal),
  });
}
