import { createHash } from 'node:crypto';
import { multiplyUnitsByRate, parseDecimal, roundHalfUpOnce } from './money';

export type EmulatedWallet = {
  kind: 'emulated';
  balanceKopecks: number;
  charges: Array<{ operationKey: string; amountKopecks: number; tenantUid: number }>;
  charge(input: { tenantUid: number; operationKey: string; amountKopecks: number }): {
    replay: boolean;
    amountKopecks: number;
    balanceAfter: number;
  };
};

export function createEmulatedWallet(openingKopecks = 100_000): EmulatedWallet {
  const seen = new Map<string, number>();
  const wallet: EmulatedWallet = {
    kind: 'emulated',
    balanceKopecks: openingKopecks,
    charges: [],
    charge(input) {
      const existing = seen.get(input.operationKey);
      if (existing != null) {
        return { replay: true, amountKopecks: existing, balanceAfter: wallet.balanceKopecks };
      }
      if (input.amountKopecks <= 0) {
        throw Object.assign(new Error('amount_invalid'), { code: 'amount_invalid' });
      }
      if (wallet.balanceKopecks < input.amountKopecks) {
        throw Object.assign(new Error('insufficient_funds'), { code: 'insufficient_funds' });
      }
      wallet.balanceKopecks -= input.amountKopecks;
      seen.set(input.operationKey, input.amountKopecks);
      wallet.charges.push(input);
      return {
        replay: false,
        amountKopecks: input.amountKopecks,
        balanceAfter: wallet.balanceKopecks,
      };
    },
  };
  return wallet;
}

export function amountToKopecks(amount: string): number {
  const parsed = parseDecimal(amount);
  const atScale2 = roundHalfUpOnce(parsed.digits, parsed.scale, 2);
  const kopecks = parseDecimal(atScale2);
  return Number(kopecks.digits);
}

export function settleEmulatedWallet(input: {
  tenantUid: number;
  reservationId: string;
  actualUnits: number;
  rate: string;
  scale: number;
  wallet: EmulatedWallet;
}): { charged: true; emulated: true; liveBilling: false; amount: string; replay: boolean } {
  if (input.wallet.kind !== 'emulated') {
    throw Object.assign(new Error('live_wallet_denied'), { code: 'live_wallet_denied' });
  }
  const amount = multiplyUnitsByRate(BigInt(input.actualUnits), input.rate, input.scale);
  const kopecks = amountToKopecks(amount);
  const result = input.wallet.charge({
    tenantUid: input.tenantUid,
    operationKey: `ai-usage:${input.reservationId}`,
    amountKopecks: kopecks,
  });
  return {
    charged: true, emulated: true, liveBilling: false, amount, replay: result.replay,
  };
}

export function emulatedWalletDigest(wallet: EmulatedWallet): string {
  return createHash('sha256')
    .update(JSON.stringify({
      kind: wallet.kind, balance: wallet.balanceKopecks, n: wallet.charges.length,
    }))
    .digest('hex');
}
