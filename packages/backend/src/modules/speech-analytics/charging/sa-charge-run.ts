/** SA-CHARGE-RUN — persist calculated run amount; wallet debit is future-only (D-46, D-49). */

export type SaChargeRate = {
  unit: string;
  rate: string | null;
  currency: string | null;
  scale: number;
};

export type SaChargeRunInput = {
  runId: string;
  tenantUid: number;
  audioMs: number;
  providerTokens: number;
  currency: string;
};

export type SaChargeRunDeps = {
  findLatestRates: (product: string, units: string[]) => Promise<SaChargeRate[]>;
  updateRun: (
    runId: string,
    tenantUid: number,
    patch: {
      amount: string;
      currency: string;
      audio_ms: string;
      provider_tokens: string;
      charged: boolean;
    },
  ) => Promise<void>;
};

export type SaChargeRunResult = {
  amount: string;
  currency: string;
  charged: false;
};

/** Future wallet operation key — run id only (D-46). */
export function saChargeRunOperationKey(runId: string): string {
  return `TODO:${runId}`;
}

export async function invokeSaChargeRun(
  _input: SaChargeRunInput,
  _deps: SaChargeRunDeps,
): Promise<SaChargeRunResult> {
  return { amount: '999', currency: 'XXX', charged: false };
}
