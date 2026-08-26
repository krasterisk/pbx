import type { IRoutePhonebook, ValueSource } from '@krasterisk/shared';

export interface DialPreviewOption {
  /** Concrete dialable sample used by the evaluator. */
  value: string;
  /** Short human label (pattern, var key, «фиксированный»). */
  label: string;
  /** When true the sample is the actual configured value, not an illustration. */
  exact?: boolean;
}

/** First concrete character of an Asterisk character class (`[2-9]`, `[15-9]`). */
function firstFromCharClass(set: string): string {
  let i = 0;
  while (i < set.length) {
    if (set[i] === '\\' && i + 1 < set.length) return set[i + 1];
    if (i + 2 < set.length && set[i + 1] === '-') return set[i];
    if (/[0-9A-Za-z*#+]/.test(set[i])) return set[i];
    i += 1;
  }
  return '0';
}

/**
 * Expand an Asterisk dialplan pattern into one concrete sample number.
 * Exact extensions (no leading `_`) pass through; pattern tokens are filled
 * with deterministic digits so the rewrite preview stays stable.
 */
export function expandAsteriskPattern(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('_')) {
    return trimmed;
  }

  const body = trimmed.slice(1);
  let out = '';
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === 'X' || ch === 'x') {
      out += '0';
      i += 1;
      continue;
    }
    if (ch === 'Z' || ch === 'z') {
      out += '1';
      i += 1;
      continue;
    }
    if (ch === 'N' || ch === 'n') {
      out += '2';
      i += 1;
      continue;
    }
    if (ch === '.') {
      out += '00';
      i += 1;
      continue;
    }
    if (ch === '!') {
      // zero-or-more — use a single digit so the sample stays dialable
      out += '0';
      i += 1;
      continue;
    }
    if (ch === '[') {
      const end = body.indexOf(']', i);
      if (end === -1) {
        out += '0';
        i += 1;
        continue;
      }
      out += firstFromCharClass(body.slice(i + 1, end));
      i = end + 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function coerceSource(
  source: ValueSource | string | number | undefined | null,
): ValueSource | undefined {
  if (source == null || source === '') return undefined;
  if (typeof source === 'number' && Number.isFinite(source)) {
    return { source: 'fixed', value: String(Math.trunc(source)) };
  }
  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (!trimmed || trimmed === '${EXTEN}' || trimmed === '__USE_EXTEN__') {
      return { source: 'route_pattern' };
    }
    return { source: 'fixed', value: trimmed };
  }
  if (typeof source === 'object' && typeof source.source === 'string') return source;
  return undefined;
}

/** Trunk rewrite demos need external-length numbers; short PBX extens are a poor sample. */
const DEFAULT_PHONE_MIN_LENGTH = 7;

/**
 * Build interactive preview candidates from the destination ValueSource.
 * Prefer real configured values; fall back to expanded route patterns /
 * phonebook entry samples when the runtime value is not known yet.
 *
 * `minLength` (used for trunk / phone charset): short route-pattern samples
 * like `201` are replaced with a long dialable fallback so prefix/strip
 * previews stay realistic for external dial.
 */
export function resolveDialPreviewOptions(
  source: ValueSource | string | number | undefined | null,
  opts: {
    routePatterns?: string[];
    phonebooks?: IRoutePhonebook[];
    fallback?: string;
    /** Replace route_pattern samples shorter than this with `fallback`. */
    minLength?: number;
  } = {},
): DialPreviewOption[] {
  const src = coerceSource(source);
  const fallback = opts.fallback ?? '79001234567';
  const minLength = opts.minLength;

  if (!src) {
    return [{ value: fallback, label: fallback }];
  }

  if (src.source === 'fixed') {
    const value = String(src.value ?? '').trim();
    if (value) return [{ value, label: value, exact: true }];
    return [{ value: fallback, label: fallback }];
  }

  if (src.source === 'variable') {
    const name = String(src.name ?? '').trim() || 'VAR';
    // Variable is runtime-only — keep a dialable fallback, label it clearly.
    return [{ value: fallback, label: `\${${name}}` }];
  }

  if (src.source === 'phonebook') {
    const pb = (opts.phonebooks ?? []).find((item) => item.uid === src.phonebookUid);
    const key = String(src.varKey ?? '').trim();
    const samples: DialPreviewOption[] = [];
    for (const entry of pb?.entries ?? []) {
      const raw = key ? entry.vars?.[key] : undefined;
      const value = String(raw ?? '').trim();
      if (!value) continue;
      const label = entry.number ? `${entry.number} → ${value}` : value;
      if (!samples.some((s) => s.value === value)) {
        samples.push({ value, label, exact: true });
      }
      if (samples.length >= 5) break;
    }
    if (samples.length) return samples;
    return [{ value: fallback, label: key ? `PB_${key}` : fallback }];
  }

  // route_pattern — expand each route extension into a concrete sample
  const patterns = (opts.routePatterns ?? []).map((p) => p.trim()).filter(Boolean);
  if (patterns.length) {
    const options: DialPreviewOption[] = [];
    for (const pattern of patterns) {
      let value = expandAsteriskPattern(pattern);
      if (!value) continue;
      const exact = !pattern.startsWith('_') && value === pattern;
      const lengthened = Boolean(minLength && value.length < minLength);
      if (lengthened) value = fallback;
      if (!options.some((o) => o.value === value)) {
        options.push({
          value,
          label: exact && !lengthened ? pattern : `${pattern} → ${value}`,
          exact: exact && !lengthened,
        });
      }
      if (options.length >= 6) break;
    }
    if (options.length) return options;
  }

  return [{ value: fallback, label: '${EXTEN}' }];
}

export { DEFAULT_PHONE_MIN_LENGTH };
