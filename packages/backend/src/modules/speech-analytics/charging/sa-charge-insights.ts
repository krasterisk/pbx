/** SA-CHARGE-INSIGHTS — persist insights-only amount; wallet debit is future-only (D-47, D-49). */

import { multiplyUnitsByRate } from '../../ai-usage/money';

export type SaInsightsChargeRate = {
  unit: string;
  rate: string | null;
  currency: string | null;
  scale: number;
};

export type SaChargeInsightsInput = {
  insightsRequestId: string;
  tenantUid: number;
  providerTokens: number;
  currency: string;
};

export type SaChargeInsightsPatch = {
  amount: string;
  currency: string;
  provider_tokens: string;
  charged: boolean;
};

export type SaChargeInsightsDeps = {
  findLatestRates: (product: string, units: string[]) => Promise<SaInsightsChargeRate[]>;
  updateInsightsRequest: (
    insightsRequestId: string,
    tenantUid: number,
    patch: SaChargeInsightsPatch,
  ) => Promise<void>;
};

export type SaChargeInsightsResult = {
  amount: string;
  currency: string;
  charged: false;
};

const PRODUCT = 'speech_analytics';
const UNIT = 'provider_tokens';

/** Future wallet operation key — insights request id only (D-47). */
export function saChargeInsightsOperationKey(insightsRequestId: string): string {
  return insightsRequestId;
}

/**
 * Persist SA-CHARGE-INSIGHTS amount for a successful insights model response.
 * Always writes charged=false. Never imports or calls wallet debit helpers (D-47…D-49).
 * Callers must skip this seam on cache hits (D-47).
 */
export async function invokeSaChargeInsights(
  input: SaChargeInsightsInput,
  deps: SaChargeInsightsDeps,
): Promise<SaChargeInsightsResult> {
  const rates = await deps.findLatestRates(PRODUCT, [UNIT]);
  const tokenRate = rates.find((row) => row.unit === UNIT);
  const scale = Math.max(tokenRate?.scale ?? 0, 2);
  const currency = tokenRate?.currency || input.currency || 'RUB';
  const tokens = BigInt(Math.max(0, Math.trunc(input.providerTokens)));

  let amount: string;
  if (!tokenRate || tokenRate.rate == null || tokenRate.rate === '') {
    amount = rates.length === 0 ? '0' : (scale > 0 ? `0.${'0'.repeat(scale)}` : '0');
  } else {
    amount = multiplyUnitsByRate(tokens, tokenRate.rate, scale);
  }

  const patch: SaChargeInsightsPatch = {
    amount,
    currency,
    provider_tokens: String(Math.max(0, Math.trunc(input.providerTokens))),
    charged: false,
  };

  await deps.updateInsightsRequest(input.insightsRequestId, input.tenantUid, patch);

  return { amount, currency, charged: false };
}
