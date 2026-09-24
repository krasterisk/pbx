/**
 * BILLING-DEBIT: ai-chat token usage.
 *
 * Called when a chat turn records token counts. The billing module should
 * price and charge this point. This function does not calculate money.
 */
export interface UsageDebitPoint {
  source: 'ai-chat';
  tenantUid: number;
  providerUid: number | null;
  tokensIn: number;
  tokensOut: number;
}

export function markUsageDebit(_point: UsageDebitPoint): void {
  // Empty until the billing module owns this debit.
}
