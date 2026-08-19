export interface NumberManipulation {
  strip?: number;
  prepend?: string;
}

/** Same charset as AsteriskDialplanUtils.sanitizeDialplanInput — kept local to avoid a util cycle. */
function sanitizePrepend(input: string): string {
  return input.replace(/[(),?\[\]{}\$\\";\n\r]/g, '').trim();
}

export function applyNumberManipulation(raw: string, m?: NumberManipulation | null): string {
  if (!m) return raw;
  let out = raw;
  const strip = m.strip ?? 0;
  if (strip > 0) {
    if (strip >= out.length) {
      throw new Error(`numberManipulation.strip ${strip} exceeds number length ${out.length}`);
    }
    out = out.slice(strip);
  }
  if (m.prepend) {
    out = `${sanitizePrepend(m.prepend)}${out}`;
  }
  return out;
}
