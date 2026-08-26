import type {
  DialRewriteCharset,
  DialRewriteCondition,
  DialRewriteRule,
  DialTargetRewrite,
  NumberManipulation,
  ValueSource,
} from '@krasterisk/shared';
import {
  coerceDialTargetRewrite,
  digitMaskToRegex,
  isAllowedRewriteRegex,
  rewriteHasWork,
} from '@krasterisk/shared';
export type { NumberManipulation };

const DIALPLAN_UNSAFE = /[(),?[\]{}$\\";\n\r]/g;

export const DIAL_SRC_VAR = 'KRSK_DIAL_SRC';
export const DIAL_NUM_VAR = 'KRSK_DIAL_NUM';
export const DIAL_MATCHED_VAR = 'KRSK_DIAL_MATCHED';
export const DIAL_OK_VAR = 'KRSK_DIAL_OK';

/** Same charset as AsteriskDialplanUtils.sanitizeDialplanInput — kept local to avoid a util cycle. */
function sanitizePrepend(input: string): string {
  return input.replace(DIALPLAN_UNSAFE, '').trim();
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

function sanitizeDialValue(input?: string): string {
  if (!input) return '';
  return input.replace(DIALPLAN_UNSAFE, '').trim();
}

function filterChars(charset: DialRewriteCharset): string {
  if (charset === 'exten') return '0-9A-Za-z*#+';
  return '0-9+*#';
}

function conditionExpr(srcVar: string, condition: DialRewriteCondition): string | undefined {
  switch (condition.kind) {
    case 'eq': {
      const value = sanitizeDialValue(condition.value);
      return `$["\${${srcVar}}" = "${value}"]`;
    }
    case 'startsWith': {
      const prefix = sanitizeDialValue(condition.value);
      if (!prefix) return undefined;
      return `$["\${${srcVar}:0:${prefix.length}}" = "${prefix}"]`;
    }
    case 'endsWith': {
      const suffix = sanitizeDialValue(condition.value);
      if (!suffix) return undefined;
      return `$["\${${srcVar}:-${suffix.length}}" = "${suffix}"]`;
    }
    case 'length': {
      const parts: string[] = [];
      if (condition.min != null && Number.isFinite(condition.min)) {
        parts.push(`$[\${LEN(${srcVar})} >= ${Math.trunc(condition.min)}]`);
      }
      if (condition.max != null && Number.isFinite(condition.max)) {
        parts.push(`$[\${LEN(${srcVar})} <= ${Math.trunc(condition.max)}]`);
      }
      if (!parts.length && condition.value != null && condition.value !== '') {
        const n = Number(condition.value);
        if (Number.isFinite(n)) parts.push(`$["\${LEN(${srcVar})}" = "${Math.trunc(n)}"]`);
      }
      if (!parts.length) return undefined;
      return parts.length === 1 ? parts[0] : `$[${parts.map((p) => p.slice(2, -1)).join(' & ')}]`;
    }
    case 'digitMask': {
      const mask = String(condition.value ?? '');
      if (!mask) return undefined;
      const pattern = digitMaskToRegex(mask);
      if (!isAllowedRewriteRegex(pattern.replace(/^\^/, '').replace(/\$$/, '')) && !isAllowedRewriteRegex(pattern)) {
        if (!/^[0-9A-Za-zXx+*#]+$/.test(mask)) return undefined;
      }
      return `$[\${REGEX("${pattern}" \${${srcVar}})} = 1]`;
    }
    case 'regex': {
      const pattern = String(condition.value ?? '');
      if (!isAllowedRewriteRegex(pattern)) return undefined;
      return `$[\${REGEX("${pattern}" \${${srcVar}})} = 1]`;
    }
    default:
      return undefined;
  }
}

function andExprs(parts: string[]): string {
  if (!parts.length) return '$[1]';
  if (parts.length === 1) return parts[0];
  const inner = parts.map((p) => {
    if (p.startsWith('$[') && p.endsWith(']')) return p.slice(2, -1);
    return p;
  });
  return `$[${inner.join(' & ')}]`;
}

function transformLines(
  gate: string,
  transform: DialRewriteRule['transform'],
): string[] {
  const lines: string[] = [];
  const exec = (app: string) => `ExecIf(${gate}?${app})`;
  lines.push(exec(`Set(${DIAL_NUM_VAR}=\${${DIAL_SRC_VAR}})`));
  if (transform.replaceAll != null && transform.replaceAll !== '') {
    lines.push(exec(`Set(${DIAL_NUM_VAR}=${sanitizeDialValue(transform.replaceAll)})`));
  }
  const startCount = transform.stripStartCount ?? 0;
  if (startCount > 0) {
    lines.push(exec(`Set(${DIAL_NUM_VAR}=\${${DIAL_NUM_VAR}:${startCount}})`));
  }
  if (transform.stripStartText) {
    const text = sanitizeDialValue(transform.stripStartText);
    if (text) {
      const textGate = andExprs([
        gate,
        `$["\${${DIAL_NUM_VAR}:0:${text.length}}" = "${text}"]`,
      ]);
      lines.push(`ExecIf(${textGate}?Set(${DIAL_NUM_VAR}=\${${DIAL_NUM_VAR}:${text.length}}))`);
    }
  }
  const endCount = transform.stripEndCount ?? 0;
  if (endCount > 0) {
    lines.push(exec(`Set(${DIAL_NUM_VAR}=\${${DIAL_NUM_VAR}:0:-${endCount}})`));
  }
  if (transform.stripEndText) {
    const text = sanitizeDialValue(transform.stripEndText);
    if (text) {
      const textGate = andExprs([
        gate,
        `$["\${${DIAL_NUM_VAR}:-${text.length}}" = "${text}"]`,
      ]);
      lines.push(`ExecIf(${textGate}?Set(${DIAL_NUM_VAR}=\${${DIAL_NUM_VAR}:0:-${text.length}}))`);
    }
  }
  if (transform.replaceFind) {
    const find = sanitizeDialValue(transform.replaceFind);
    const repl = sanitizeDialValue(transform.replaceWith);
    if (find) {
      lines.push(exec(`Set(${DIAL_NUM_VAR}=\${STRREPLACE(${DIAL_NUM_VAR},${find},${repl})})`));
    }
  }
  if (transform.prefix) {
    lines.push(exec(`Set(${DIAL_NUM_VAR}=${sanitizeDialValue(transform.prefix)}\${${DIAL_NUM_VAR}})`));
  }
  if (transform.postfix) {
    lines.push(exec(`Set(${DIAL_NUM_VAR}=\${${DIAL_NUM_VAR}}${sanitizeDialValue(transform.postfix)})`));
  }
  lines.push(exec(`Set(${DIAL_MATCHED_VAR}=1)`));
  return lines;
}

export interface CompileDialRewriteResult {
  lines: string[];
  destExpr: string;
  usedRewrite: boolean;
}

export function compileDialTargetRewrite(
  sourceExpr: string,
  rewrite: DialTargetRewrite | undefined,
  charset: DialRewriteCharset = 'phone',
): CompileDialRewriteResult {
  if (!rewriteHasWork(rewrite)) {
    return { lines: [], destExpr: sourceExpr, usedRewrite: false };
  }

  const lines: string[] = [
    `Set(${DIAL_SRC_VAR}=${sourceExpr})`,
    `Set(${DIAL_MATCHED_VAR}=0)`,
    `Set(${DIAL_NUM_VAR}=)`,
    `Set(${DIAL_OK_VAR}=0)`,
  ];

  for (const rule of rewrite?.rules ?? []) {
    if (rule.enabled === false) continue;
    const conds = (rule.conditions ?? [])
      .map((c) => conditionExpr(DIAL_SRC_VAR, c))
      .filter((c): c is string => Boolean(c));
    const gate = andExprs([`$["\${${DIAL_MATCHED_VAR}}" = "0"]`, ...conds]);
    lines.push(...transformLines(gate, rule.transform ?? {}));
  }

  const noMatch = rewrite?.noMatch === 'reject' ? 'reject' : 'passthrough';
  if (noMatch === 'passthrough') {
    lines.push(`ExecIf($["\${${DIAL_MATCHED_VAR}}" = "0"]?Set(${DIAL_NUM_VAR}=\${${DIAL_SRC_VAR}}))`);
    lines.push(`ExecIf($["\${${DIAL_MATCHED_VAR}}" = "0"]?Set(${DIAL_MATCHED_VAR}=1))`);
  }

  const allowed = filterChars(charset);
  lines.push(`ExecIf($["\${${DIAL_NUM_VAR}}" != "" & "\${FILTER(${allowed},\${${DIAL_NUM_VAR}})}" = "\${${DIAL_NUM_VAR}}"]?Set(${DIAL_OK_VAR}=1))`);
  lines.push(`ExecIf($["\${${DIAL_OK_VAR}}" != "1"]?NoOp(Invalid rewritten dest))`);

  return {
    lines,
    destExpr: `\${${DIAL_NUM_VAR}}`,
    usedRewrite: true,
  };
}

export function sourceExprFromValueSource(src: ValueSource): string {
  if (src.source === 'fixed') {
    return sanitizeDialValue(src.value);
  }
  if (src.source === 'variable') {
    const name = sanitizeDialValue(src.name);
    return name ? `\${${name}}` : '';
  }
  if (src.source === 'phonebook') {
    return '${PB_TARGET}';
  }
  return '${EXTEN}';
}

export function rewriteFromParams(params: Record<string, unknown> | undefined): DialTargetRewrite | undefined {
  return coerceDialTargetRewrite(params);
}

export function wrapIfRewriteOk(usedRewrite: boolean, app: string): string {
  if (!usedRewrite) return app;
  return `ExecIf($["\${${DIAL_OK_VAR}}" = "1"]?${app})`;
}
