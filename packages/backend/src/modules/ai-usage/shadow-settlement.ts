import type { MoneyPolicy, PriceRow, UsageStores } from './usage-engine';
import { settleReservation } from './usage-engine';

export type WalletProbe = {
  chargeCalls: number;
  lookupCalls: number;
  charge: () => void;
  lookupBalance: () => number;
};

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

export function assertCloudWalletDisabled(policy: MoneyPolicy): void {
  if (policy === 'cloud_wallet') {
    throw Object.assign(new Error('cloud_wallet processing is disabled until AI-10'), { code: 'cloud_wallet_disabled' });
  }
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
    /* BYOK must not look up a cloud wallet balance or pretend the rate is zero. */
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
