import type { BillingBalanceService } from '../cloud-admin/billing/billing-balance.service';
import { amountToKopecks } from './emulated-wallet';
import {
  assertNoLiveTenantDebit, type BillingChargeFn,
} from './shadow-settlement';

/**
 * Opt-in adapter around the existing wallet. Not registered on AiUsageModule.
 * Callers must pass live-tenant ids to refuse production debit in CI.
 */
export function billingChargeFromBalanceService(
  billing: Pick<BillingBalanceService, 'charge'>,
  performedBy: number,
  liveTenantUids: readonly number[] = [],
): BillingChargeFn {
  return async (input) => {
    assertNoLiveTenantDebit([input], liveTenantUids);
    const kopecks = amountToKopecks(input.amountDecimal);
    const result = await billing.charge(
      input.tenantUid,
      kopecks / 100,
      performedBy,
      'AI usage settlement',
      undefined,
      'charge',
      input.operationKey,
    );
    return { replay: result.replay === true };
  };
}
