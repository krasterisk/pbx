/** SA-CHARGE-RUN — persist calculated run amount; wallet debit is future-only (D-46, D-49). */

import { multiplyUnitsByRate, sumChunksRoundOnce } from '../../ai-usage/money';

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
  /** Cabinet currency fallback when rates omit currency (D-46). */
  currency: string;
};

export type SaChargeRunPatch = {
  amount: string;
  currency: string;
  audio_ms: string;
  provider_tokens: string;
  charged: boolean;
};

export type SaChargeRunDeps = {
  findLatestRates: (product: string, units: string[]) => Promise<SaChargeRate[]>;
  updateRun: (runId: string, tenantUid: number, patch: SaChargeRunPatch) => Promise<void>;
};

export type SaChargeRunResult = {
  amount: string;
  currency: string;
  charged: false;
};

const PRODUCT = 'speech_analytics';
const UNITS = ['audio_ms', 'provider_tokens'] as const;

/** Future wallet operation key — run id only (D-46). */
export function saChargeRunOperationKey(runId: string): string {
  return runId;
}

function rateFor(rates: SaChargeRate[], unit: string): SaChargeRate | undefined {
  return rates.find((row) => row.unit === unit);
}

function partAmount(units: bigint, rate: SaChargeRate | undefined, scale: number): string {
  if (!rate || rate.rate == null || rate.rate === '') {
    return scale > 0 ? `0.${'0'.repeat(scale)}` : '0';
  }
  return multiplyUnitsByRate(units, rate.rate, scale);
}

/**
 * Persist SA-CHARGE-RUN amount on a successful analysis run.
 * Always writes charged=false. Never imports or calls wallet debit helpers (D-46, D-48, D-49).
 * Invoked even when the calculated total is 0 (including missing rates).
 */
export async function invokeSaChargeRun(
  input: SaChargeRunInput,
  deps: SaChargeRunDeps,
): Promise<SaChargeRunResult> {
  const rates = await deps.findLatestRates(PRODUCT, [...UNITS]);
  const audioRate = rateFor(rates, 'audio_ms');
  const tokenRate = rateFor(rates, 'provider_tokens');
  const scale = Math.max(audioRate?.scale ?? 0, tokenRate?.scale ?? 0, 2);
  const currency = audioRate?.currency || tokenRate?.currency || input.currency || 'RUB';

  const audioPart = partAmount(BigInt(Math.max(0, Math.trunc(input.audioMs))), audioRate, scale);
  const tokenPart = partAmount(
    BigInt(Math.max(0, Math.trunc(input.providerTokens))),
    tokenRate,
    scale,
  );
  const amount = rates.length === 0
    ? '0'
    : sumChunksRoundOnce([audioPart, tokenPart], scale, 'half_up');

  const patch: SaChargeRunPatch = {
    amount,
    currency,
    audio_ms: String(Math.max(0, Math.trunc(input.audioMs))),
    provider_tokens: String(Math.max(0, Math.trunc(input.providerTokens))),
    charged: false,
  };

  await deps.updateRun(input.runId, input.tenantUid, patch);

  return { amount, currency, charged: false };
}
