import type {
  DialRewriteCharset,
  DialRewriteCondition,
  DialRewriteEvalResult,
  DialRewriteNoMatchPolicy,
  DialRewriteRule,
  DialRewriteTransform,
  DialTargetRewrite,
  NumberManipulation,
  ValueSource,
} from '../types/dialplan-params.types';

const ROUTE_PATTERN_TOKENS = new Set(['', '${EXTEN}', '__USE_EXTEN__']);

const CHARSET_RE: Record<DialRewriteCharset, RegExp> = {
  phone: /^[0-9+*#]+$/,
  exten: /^[0-9A-Za-z*#+]+$/,
  generic: /^[^(),?[\]{}$\\";\n\r]+$/,
};

const FORBIDDEN_REGEX = /(\(\?[:=!<]|\\[1-9dwWsSbB]|\\k|<\w+>)/;
const REGEX_ALLOWED = /^[0-9A-Za-z^$.|()?*+[\]{}-]+$/;

export function isAllowedRewriteRegex(pattern: string): boolean {
  if (!pattern || pattern.length > 128) return false;
  if (FORBIDDEN_REGEX.test(pattern)) return false;
  if (!REGEX_ALLOWED.test(pattern)) return false;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export function coerceDestValueSource(raw: unknown): ValueSource {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as { source?: unknown }).source === 'string') {
    const src = raw as ValueSource;
    if (src.source === 'fixed' && (src.value === '${EXTEN}' || src.value === '__USE_EXTEN__')) {
      return { source: 'route_pattern' };
    }
    return src;
  }
  if (typeof raw === 'string') {
    return ROUTE_PATTERN_TOKENS.has(raw) ? { source: 'route_pattern' } : { source: 'fixed', value: raw };
  }
  return { source: 'route_pattern' };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasTransform(transform?: DialRewriteTransform | null): boolean {
  if (!transform) return false;
  return Boolean(
    transform.replaceAll
    || transform.stripStartCount
    || transform.stripStartText
    || transform.stripEndCount
    || transform.stripEndText
    || transform.replaceFind
    || transform.replaceWith
    || transform.prefix
    || transform.postfix,
  );
}

function fromLegacyManipulation(
  nested?: NumberManipulation | null,
  strip?: unknown,
  prepend?: unknown,
): DialTargetRewrite | undefined {
  const stripN = nested?.strip ?? (typeof strip === 'number' ? strip : undefined);
  const prefix = nested?.prepend ?? (typeof prepend === 'string' ? prepend : undefined);
  if (!(stripN && stripN > 0) && !prefix) return undefined;
  return {
    noMatch: 'passthrough',
    rules: [{
      id: 'legacy',
      enabled: true,
      conditions: [],
      transform: {
        ...(stripN && stripN > 0 ? { stripStartCount: stripN } : {}),
        ...(prefix ? { prefix } : {}),
      },
    }],
  };
}

export function coerceDialTargetRewrite(params: Record<string, unknown> | undefined): DialTargetRewrite | undefined {
  const p = params ?? {};
  const raw = p.rewrite;
  if (isPlainObject(raw) && (Array.isArray(raw.rules) || raw.noMatch === 'passthrough' || raw.noMatch === 'reject')) {
    const rules = Array.isArray(raw.rules) ? (raw.rules as DialRewriteRule[]) : [];
    return {
      noMatch: raw.noMatch === 'reject' ? 'reject' : 'passthrough',
      rules,
    };
  }
  return fromLegacyManipulation(
    isPlainObject(p.numberManipulation) ? p.numberManipulation as NumberManipulation : undefined,
    p.strip,
    p.prepend,
  );
}

export function liftDialTargetRewrite(params: Record<string, unknown>): {
  params: Record<string, unknown>;
  changed: boolean;
} {
  const next = { ...params };
  let changed = false;

  if ('dest' in next) {
    const dest = next.dest;
    const coerced = coerceDestValueSource(dest);
    const destChanged = JSON.stringify(dest) !== JSON.stringify(coerced);
    if (destChanged) {
      next.dest = coerced;
      changed = true;
    }
  }

  if (isPlainObject(next.rewrite) && Array.isArray(next.rewrite.rules)) {
    if ('strip' in next || 'prepend' in next) {
      delete next.strip;
      delete next.prepend;
      changed = true;
    }
    return { params: next, changed };
  }

  const lifted = fromLegacyManipulation(
    isPlainObject(next.numberManipulation) ? next.numberManipulation as NumberManipulation : undefined,
    next.strip,
    next.prepend,
  );
  if (!lifted) return { params: next, changed };

  next.rewrite = lifted;
  delete next.strip;
  delete next.prepend;
  delete next.numberManipulation;
  return { params: next, changed: true };
}

function matchDigitMask(input: string, mask: string): boolean {
  if (!mask || input.length !== mask.length) return false;
  for (let i = 0; i < mask.length; i += 1) {
    const token = mask[i];
    const ch = input[i];
    if (token === 'X' || token === 'x') {
      if (!/[0-9]/.test(ch)) return false;
    } else if (ch !== token) {
      return false;
    }
  }
  return true;
}

/** Compile a digit mask to a POSIX/JS-safe regex (no backslashes). */
export function digitMaskToRegex(mask: string): string {
  const body = mask.split('').map((ch) => {
    if (ch === 'X' || ch === 'x') return '[0-9]';
    if (/[0-9A-Za-z]/.test(ch)) return ch;
    return `[${ch}]`;
  }).join('');
  return `^${body}$`;
}

function conditionMatches(input: string, condition: DialRewriteCondition): boolean {
  switch (condition.kind) {
    case 'eq':
      return input === String(condition.value ?? '');
    case 'startsWith': {
      const prefix = String(condition.value ?? '');
      return prefix.length > 0 && input.startsWith(prefix);
    }
    case 'endsWith': {
      const suffix = String(condition.value ?? '');
      return suffix.length > 0 && input.endsWith(suffix);
    }
    case 'length': {
      const len = input.length;
      if (condition.min != null && Number.isFinite(condition.min) && len < condition.min) return false;
      if (condition.max != null && Number.isFinite(condition.max) && len > condition.max) return false;
      if (condition.min == null && condition.max == null && condition.value != null && condition.value !== '') {
        return len === Number(condition.value);
      }
      return condition.min != null || condition.max != null;
    }
    case 'digitMask':
      return matchDigitMask(input, String(condition.value ?? ''));
    case 'regex': {
      const pattern = String(condition.value ?? '');
      if (!isAllowedRewriteRegex(pattern)) return false;
      return new RegExp(pattern).test(input);
    }
    default:
      return false;
  }
}

function ruleMatches(input: string, rule: DialRewriteRule): boolean {
  if (rule.enabled === false) return false;
  const conditions = rule.conditions ?? [];
  if (!conditions.length) return true;
  return conditions.every((condition) => conditionMatches(input, condition));
}

function applyTransform(input: string, transform: DialRewriteTransform): string {
  let out = transform.replaceAll != null && transform.replaceAll !== ''
    ? String(transform.replaceAll)
    : input;

  const startCount = transform.stripStartCount ?? 0;
  if (startCount > 0) {
    out = out.slice(startCount);
  }
  if (transform.stripStartText && out.startsWith(transform.stripStartText)) {
    out = out.slice(transform.stripStartText.length);
  }

  const endCount = transform.stripEndCount ?? 0;
  if (endCount > 0) {
    out = out.slice(0, Math.max(0, out.length - endCount));
  }
  if (transform.stripEndText && out.endsWith(transform.stripEndText)) {
    out = out.slice(0, Math.max(0, out.length - transform.stripEndText.length));
  }

  if (transform.replaceFind) {
    out = out.split(transform.replaceFind).join(transform.replaceWith ?? '');
  }

  if (transform.prefix) out = `${transform.prefix}${out}`;
  if (transform.postfix) out = `${out}${transform.postfix}`;
  return out;
}

export function matchesCharset(value: string, charset: DialRewriteCharset): boolean {
  return CHARSET_RE[charset].test(value);
}

export function evaluateDialTargetRewrite(
  input: string,
  rewrite: DialTargetRewrite | undefined,
  charset: DialRewriteCharset = 'phone',
): DialRewriteEvalResult {
  const rules = (rewrite?.rules ?? []).filter((rule) => rule && rule.enabled !== false);
  const noMatch: DialRewriteNoMatchPolicy = rewrite?.noMatch === 'reject' ? 'reject' : 'passthrough';

  if (!rules.length) {
    if (!input) return { output: '', matchedRuleId: null, error: 'empty' };
    if (!matchesCharset(input, charset)) {
      return { output: input, matchedRuleId: null, error: 'charset' };
    }
    return { output: input, matchedRuleId: null };
  }

  const matched = rules.find((rule) => ruleMatches(input, rule));
  if (!matched) {
    if (noMatch === 'reject') {
      return { output: '', matchedRuleId: null, error: 'rejected' };
    }
    if (!input) return { output: '', matchedRuleId: null, error: 'empty' };
    if (!matchesCharset(input, charset)) {
      return { output: input, matchedRuleId: null, error: 'charset' };
    }
    return { output: input, matchedRuleId: null };
  }

  const regexError = (matched.conditions ?? []).some(
    (c) => c.kind === 'regex' && !isAllowedRewriteRegex(String(c.value ?? '')),
  );
  if (regexError) {
    return { output: '', matchedRuleId: matched.id, error: 'invalid_regex' };
  }

  const output = applyTransform(input, matched.transform ?? {});
  if (!output) return { output: '', matchedRuleId: matched.id, error: 'empty' };
  if (!matchesCharset(output, charset)) {
    return { output, matchedRuleId: matched.id, error: 'charset' };
  }
  return { output, matchedRuleId: matched.id };
}

export function rewriteHasWork(rewrite: DialTargetRewrite | undefined): boolean {
  if (!rewrite) return false;
  if (rewrite.noMatch === 'reject') return true;
  return (rewrite.rules ?? []).some((rule) => rule.enabled !== false && (hasTransform(rule.transform) || (rule.conditions?.length ?? 0) > 0));
}

export function createEmptyRewriteRule(id: string): DialRewriteRule {
  return {
    id,
    enabled: true,
    conditions: [],
    transform: {},
  };
}

export { CHARSET_RE };
