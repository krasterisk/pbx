/** SA-CHARGE-INSIGHTS — persist insights-only amount; wallet debit is future-only (D-47, D-49). */

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

export type SaChargeInsightsDeps = {
  findLatestRates: (product: string, units: string[]) => Promise<SaInsightsChargeRate[]>;
  updateInsightsRequest: (
    insightsRequestId: string,
    tenantUid: number,
    patch: {
      amount: string;
      currency: string;
      provider_tokens: string;
      charged: boolean;
    },
  ) => Promise<void>;
};

export type SaChargeInsightsResult = {
  amount: string;
  currency: string;
  charged: false;
};

/** Future wallet operation key — insights request id only (D-47). */
export function saChargeInsightsOperationKey(insightsRequestId: string): string {
  return `TODO:${insightsRequestId}`;
}

export async function invokeSaChargeInsights(
  _input: SaChargeInsightsInput,
  _deps: SaChargeInsightsDeps,
): Promise<SaChargeInsightsResult> {
  return { amount: '999', currency: 'XXX', charged: false };
}
