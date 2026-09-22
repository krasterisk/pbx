import { parseDecimal, sumChunksRoundOnce } from '../../ai-usage/money';

export type SaChargeRunRow = {
  amount: string | null;
  currency: string | null;
  createdAt: Date | string;
};

export type BudgetPeriod = { from: Date; to: Date };

/** Soft budget sums ALL SA-CHARGE-RUN amounts in the period (D-28). Insights excluded by caller. */
export function sumSaChargeRunAmounts(
  rows: readonly SaChargeRunRow[],
  period: BudgetPeriod,
  currency: string,
): string {
  const fromMs = period.from.getTime();
  const toMs = period.to.getTime();
  const chunks: string[] = [];
  for (const row of rows) {
    if (!row.amount) continue;
    if ((row.currency ?? currency) !== currency) continue;
    const at = typeof row.createdAt === 'string' ? new Date(row.createdAt) : row.createdAt;
    const t = at.getTime();
    if (t < fromMs || t > toMs) continue;
    chunks.push(row.amount);
  }
  if (chunks.length === 0) return '0';
  const scale = Math.max(...chunks.map((c) => parseDecimal(c).scale), 2);
  return sumChunksRoundOnce(chunks, scale, 'half_up');
}

export type BudgetSoftLimitResult = {
  exceeded: boolean;
  /** Analyses are never stopped for soft budget (D-28). */
  stopAnalyses: false;
  shouldAlert: boolean;
  shouldWebhook: boolean;
  spent: string;
  softLimit: number;
};

/** Soft limit: zero means no limit; over limit → alert + webhook, never stop analyses (D-28). */
export function evaluateBudgetSoftLimit(input: {
  softLimit: number;
  spent: string;
}): BudgetSoftLimitResult {
  if (!Number.isFinite(input.softLimit) || input.softLimit <= 0) {
    return {
      exceeded: false,
      stopAnalyses: false,
      shouldAlert: false,
      shouldWebhook: false,
      spent: input.spent,
      softLimit: input.softLimit,
    };
  }
  const spent = parseDecimal(input.spent);
  const limit = parseDecimal(String(input.softLimit));
  let spentDigits = spent.digits;
  let limitDigits = limit.digits;
  const scale = Math.max(spent.scale, limit.scale);
  if (spent.scale < scale) spentDigits *= 10n ** BigInt(scale - spent.scale);
  if (limit.scale < scale) limitDigits *= 10n ** BigInt(scale - limit.scale);
  const exceeded = spentDigits >= limitDigits;
  return {
    exceeded,
    stopAnalyses: false,
    shouldAlert: exceeded,
    shouldWebhook: exceeded,
    spent: input.spent,
    softLimit: input.softLimit,
  };
}
