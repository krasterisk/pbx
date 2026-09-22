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

/**
 * RED stub: returns stopAnalyses:true on exceed (wrong) and ignores zero=no-limit.
 */
export function evaluateBudgetSoftLimit(input: {
  softLimit: number;
  spent: string;
}): BudgetSoftLimitResult {
  const spentNum = Number(input.spent);
  const exceeded = spentNum > 0 && spentNum >= input.softLimit;
  return {
    exceeded,
    // INTENTIONAL RED: analyses must never stop — stub stops them
    stopAnalyses: true,
    shouldAlert: exceeded,
    shouldWebhook: exceeded,
    spent: input.spent,
    softLimit: input.softLimit,
  } as BudgetSoftLimitResult;
}
