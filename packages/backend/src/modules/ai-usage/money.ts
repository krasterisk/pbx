/** Integer decimal arithmetic. Never use IEEE floats for money. */

export type RoundingMode = 'half_up';

export function parseDecimal(value: string): { digits: bigint; scale: number } {
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw new Error('money must be a decimal string');
  }
  const negative = value.startsWith('-');
  const [whole, frac = ''] = (negative ? value.slice(1) : value).split('.');
  const digits = BigInt(whole + frac) * (negative ? -1n : 1n);
  return { digits, scale: frac.length };
}

export function formatDecimal(digits: bigint, scale: number): string {
  const sign = digits < 0n ? '-' : '';
  const abs = digits < 0n ? -digits : digits;
  const padded = abs.toString().padStart(scale + 1, '0');
  if (scale === 0) return sign + padded;
  return `${sign}${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
}

export function roundHalfUpOnce(digits: bigint, fromScale: number, toScale: number): string {
  if (toScale > fromScale) {
    return formatDecimal(digits * 10n ** BigInt(toScale - fromScale), toScale);
  }
  const factor = 10n ** BigInt(fromScale - toScale);
  const half = factor / 2n;
  const negative = digits < 0n;
  const abs = negative ? -digits : digits;
  const rounded = (abs + half) / factor;
  return formatDecimal(negative ? -rounded : rounded, toScale);
}

/** Sum chunk amounts at native scale, round once at the end. */
export function sumChunksRoundOnce(chunks: string[], toScale: number, mode: RoundingMode): string {
  if (mode !== 'half_up') throw new Error('unsupported rounding');
  let digits = 0n;
  let scale = 0;
  for (const chunk of chunks) {
    const parsed = parseDecimal(chunk);
    if (parsed.scale > scale) {
      digits *= 10n ** BigInt(parsed.scale - scale);
      scale = parsed.scale;
    } else if (parsed.scale < scale) {
      parsed.digits *= 10n ** BigInt(scale - parsed.scale);
    }
    digits += parsed.digits;
  }
  return roundHalfUpOnce(digits, scale, toScale);
}

export function multiplyUnitsByRate(units: bigint, rate: string, toScale: number): string {
  const parsed = parseDecimal(rate);
  return roundHalfUpOnce(units * parsed.digits, parsed.scale, toScale);
}
