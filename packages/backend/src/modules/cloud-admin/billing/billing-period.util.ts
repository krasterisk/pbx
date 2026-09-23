export const BILLING_PERIODS = ['hour', 'day', 'week', 'month', 'year', 'custom'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];
export type TenantBillingPeriod = BillingPeriod | 'lifetime';

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return typeof value === 'string' && (BILLING_PERIODS as readonly string[]).includes(value);
}

export function normalizeIntervalCount(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function listPriceRub(row: { price_amount?: unknown; price_monthly?: unknown } | null | undefined): number {
  if (!row) return 0;
  if (row.price_amount != null && row.price_amount !== '') {
    const amount = Number(row.price_amount);
    if (Number.isFinite(amount)) return amount;
  }
  const monthly = Number(row.price_monthly);
  return Number.isFinite(monthly) ? monthly : 0;
}

export function mapLegacyCycle(cycle: string | null | undefined): TenantBillingPeriod {
  if (cycle === 'yearly' || cycle === 'year') return 'year';
  if (cycle === 'lifetime') return 'lifetime';
  if (isBillingPeriod(cycle)) return cycle;
  return 'month';
}

export function addBillingPeriod(from: Date, period: BillingPeriod, intervalCount = 1): Date {
  const n = normalizeIntervalCount(intervalCount);
  switch (period) {
    case 'hour':
    case 'custom':
      return new Date(from.getTime() + n * 3_600_000);
    case 'day': {
      const next = new Date(from.getTime());
      next.setUTCDate(next.getUTCDate() + n);
      return next;
    }
    case 'week': {
      const next = new Date(from.getTime());
      next.setUTCDate(next.getUTCDate() + n * 7);
      return next;
    }
    case 'month': {
      const day = from.getUTCDate();
      const target = new Date(Date.UTC(
        from.getUTCFullYear(),
        from.getUTCMonth() + n,
        1,
        from.getUTCHours(),
        from.getUTCMinutes(),
        from.getUTCSeconds(),
        from.getUTCMilliseconds(),
      ));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(day, lastDay));
      return target;
    }
    case 'year': {
      const day = from.getUTCDate();
      const target = new Date(Date.UTC(
        from.getUTCFullYear() + n,
        from.getUTCMonth(),
        1,
        from.getUTCHours(),
        from.getUTCMinutes(),
        from.getUTCSeconds(),
        from.getUTCMilliseconds(),
      ));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(day, lastDay));
      return target;
    }
    default:
      return new Date(from.getTime() + n * 3_600_000);
  }
}

export function isSubscriptionDue(
  now: Date,
  lastBilledAt: Date | null | undefined,
  period: TenantBillingPeriod,
  intervalCount = 1,
): boolean {
  if (period === 'lifetime') return false;
  if (!lastBilledAt) return true;
  return now.getTime() >= addBillingPeriod(lastBilledAt, period, intervalCount).getTime();
}

export function subscriptionOperationKey(
  tenantId: number,
  moduleCode: string,
  lastBilledAt: Date | null | undefined,
): string {
  const bucket = lastBilledAt ? lastBilledAt.toISOString() : 'initial';
  return `subscription:${tenantId}:${moduleCode}:${bucket}`;
}
