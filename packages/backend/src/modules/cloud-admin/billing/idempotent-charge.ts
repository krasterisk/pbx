export type ChargeDecision =
  | { kind: 'replay' }
  | { kind: 'debit'; balanceAfter: number; blocked: boolean };

export function decideCharge(input: {
  existing: boolean;
  balanceKopecks: number;
  creditLimitKopecks: number;
  amountKopecks: number;
}): ChargeDecision {
  if (input.existing) return { kind: 'replay' };
  const balanceAfter = input.balanceKopecks - input.amountKopecks;
  return {
    kind: 'debit',
    balanceAfter,
    blocked: balanceAfter < 0 && input.creditLimitKopecks === 0,
  };
}

export function usageChargeOperationKey(reservationId: string): string {
  return `ai-usage:${reservationId}`;
}

export function purchaseChargeOperationKey(tenantId: number, moduleCode: string): string {
  return `purchase:${tenantId}:${moduleCode}`;
}

export function subscriptionChargeOperationKey(tenantId: number, periodYm: string): string {
  return `subscription:${tenantId}:${periodYm}`;
}
