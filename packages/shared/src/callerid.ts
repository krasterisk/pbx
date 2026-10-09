import type { CallValueSource, DirectoryValueSource } from './types/directory.types';
import type {
  DialTargetRewrite,
  DialRewriteCondition,
  DialRewriteTransform,
} from './types/dialplan-params.types';
import type { ICallerIdLegacyParams } from './types/notification.types';
import { evaluateDialTargetRewrite, isAllowedRewriteRegex } from './utils/dial-target-rewrite';

export type CallerIdMissingPolicy = 'keep' | 'empty' | 'hangup';
export type CallerIdErrorPolicy = 'keep' | 'hangup';
export type CallerIdListPick = 'mapping' | 'first' | 'random' | 'round_robin';
export type CallerIdSource =
  | { source: 'current' }
  | { source: 'fixed'; value: string }
  | { source: 'variable'; name: string }
  | (Omit<DirectoryValueSource, 'onMissing'> & { onMissing: 'keep' })
  | { source: 'number_list'; listUid: number; pick: CallerIdListPick; keySource: CallValueSource }
  | { source: 'pool'; numbers: string[]; pick: 'random' | 'round_robin' };
export interface CallerIdField {
  source: CallerIdSource;
  rewrite?: DialTargetRewrite;
  clear?: boolean;
  onMissing?: CallerIdMissingPolicy;
  onError?: CallerIdErrorPolicy;
}
export interface ICallerIdV2Params {
  version: 2;
  number?: CallerIdField;
  name?: CallerIdField;
}
export type CallerIdParams = ICallerIdLegacyParams | ICallerIdV2Params;
export const CALLERID_PHONE_RE = /^[0-9+*#]{1,79}$/;
export const CALLERID_VARIABLE_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
export const callerIdVariableAllowed = (value: unknown): value is string =>
  typeof value === 'string' &&
  CALLERID_VARIABLE_RE.test(value) &&
  !/^(?:KRSK_|TC_|CID_|ORIG|CLIDNUM$|CALLERID$|EXTEN$|UNIQUEID$|CHANNEL$|DIALSTATUS$)/i.test(value);
const plain = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.entries(value).every(([key, entry]) => entry === undefined || allowed.includes(key));
const text = (value: unknown): value is string =>
  typeof value === 'string' &&
  Array.from(value).length <= 128 &&
  !/[\u0000-\u001f\u007f]/.test(value);
const uid = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
export function isCallerIdKeySource(value: unknown): value is CallValueSource {
  if (!plain(value)) return false;
  if (['original_caller', 'current_caller', 'route_pattern'].includes(String(value.source)))
    return keys(value, ['source']);
  if (value.source === 'fixed') return keys(value, ['source', 'value']) && text(value.value);
  return (
    value.source === 'variable' &&
    keys(value, ['source', 'name']) &&
    callerIdVariableAllowed(value.name)
  );
}
function validRewrite(value: unknown, target: 'number' | 'name'): boolean {
  if (
    !plain(value) ||
    !keys(value, ['rules', 'noMatch']) ||
    (value.noMatch !== undefined && !['passthrough', 'reject'].includes(String(value.noMatch)))
  )
    return false;
  if (!Array.isArray(value.rules) || value.rules.length > 20) return false;
  return value.rules.every((raw) => {
    if (
      !plain(raw) ||
      !keys(raw, ['id', 'enabled', 'conditions', 'transform']) ||
      typeof raw.id !== 'string' ||
      !raw.id ||
      raw.id.length > 64 ||
      (raw.enabled !== undefined && typeof raw.enabled !== 'boolean') ||
      !plain(raw.transform)
    )
      return false;
    const t = raw.transform;
    if (
      !keys(t, [
        'replaceAll',
        'stripStartCount',
        'stripEndCount',
        'stripStartText',
        'stripEndText',
        'replaceFind',
        'replaceWith',
        'prefix',
        'postfix',
      ])
    )
      return false;
    for (const [key, entry] of Object.entries(t)) {
      if (entry === undefined) continue;
      if (key.endsWith('Count')) {
        if (!Number.isInteger(entry) || Number(entry) < 0 || Number(entry) > 128) return false;
      } else if (
        !text(entry) ||
        (target === 'number' && entry !== '' && !CALLERID_PHONE_RE.test(String(entry)))
      )
        return false;
    }
    if (
      raw.conditions !== undefined &&
      (!Array.isArray(raw.conditions) || raw.conditions.length > 8)
    )
      return false;
    return (Array.isArray(raw.conditions) ? raw.conditions : []).every((c) => {
      if (!plain(c) || !keys(c, ['kind', 'value', 'min', 'max'])) return false;
      const kinds =
        target === 'name'
          ? ['eq', 'startsWith', 'endsWith', 'length']
          : ['eq', 'startsWith', 'endsWith', 'length', 'digitMask', 'regex'];
      if (!kinds.includes(String(c.kind))) return false;
      if (c.kind === 'length')
        return (
          (c.min !== undefined || c.max !== undefined || c.value !== undefined) &&
          [c.min, c.max].every(
            (n) => n === undefined || (Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 128),
          ) &&
          (c.value === undefined || /^[0-9]{1,3}$/.test(String(c.value))) &&
          (c.min === undefined || c.max === undefined || Number(c.min) <= Number(c.max))
        );
      if (!text(c.value) || !c.value) return false;
      if (c.kind === 'regex') return isAllowedRewriteRegex(c.value);
      if (c.kind === 'digitMask') return /^_?[0-9XNZ+*#\[\].!\-]+$/.test(c.value);
      return target === 'name' || CALLERID_PHONE_RE.test(c.value);
    });
  });
}
export function callerIdV2Errors(value: unknown): string[] {
  if (!plain(value) || value.version !== 2 || !keys(value, ['version', 'number', 'name']))
    return ['callerid.version'];
  const errors: string[] = [];
  for (const target of ['number', 'name'] as const) {
    const field = value[target];
    if (field === undefined) continue;
    const fail = () => {
      errors.push('callerid.' + target);
    };
    if (
      !plain(field) ||
      !keys(field, ['source', 'rewrite', 'clear', 'onMissing', 'onError']) ||
      !plain(field.source)
    ) {
      fail();
      continue;
    }
    if (
      (field.clear !== undefined && typeof field.clear !== 'boolean') ||
      (field.onMissing !== undefined &&
        !['keep', 'empty', 'hangup'].includes(String(field.onMissing))) ||
      (field.onError !== undefined && !['keep', 'hangup'].includes(String(field.onError))) ||
      (field.rewrite !== undefined && !validRewrite(field.rewrite, target))
    ) {
      fail();
      continue;
    }
    const s = field.source;
    if (s.source === 'current' && keys(s, ['source'])) continue;
    if (
      s.source === 'fixed' &&
      keys(s, ['source', 'value']) &&
      text(s.value) &&
      (target === 'name' || s.value === '' || CALLERID_PHONE_RE.test(String(s.value)))
    )
      continue;
    if (s.source === 'variable' && keys(s, ['source', 'name']) && callerIdVariableAllowed(s.name))
      continue;
    if (
      s.source === 'directory' &&
      keys(s, ['source', 'directoryUid', 'valueFieldUid', 'keySource', 'onMissing']) &&
      uid(s.directoryUid) &&
      uid(s.valueFieldUid) &&
      isCallerIdKeySource(s.keySource) &&
      s.onMissing === 'keep'
    )
      continue;
    if (
      target === 'number' &&
      s.source === 'number_list' &&
      keys(s, ['source', 'listUid', 'pick', 'keySource']) &&
      uid(s.listUid) &&
      ['mapping', 'first', 'random', 'round_robin'].includes(String(s.pick)) &&
      isCallerIdKeySource(s.keySource)
    )
      continue;
    if (
      target === 'number' &&
      s.source === 'pool' &&
      keys(s, ['source', 'numbers', 'pick']) &&
      ['random', 'round_robin'].includes(String(s.pick)) &&
      Array.isArray(s.numbers) &&
      s.numbers.length > 0 &&
      s.numbers.length <= 100 &&
      s.numbers.every((n) => typeof n === 'string' && CALLERID_PHONE_RE.test(n)) &&
      new Set(s.numbers).size === s.numbers.length
    )
      continue;
    fail();
  }
  return errors;
}
export function normalizeCallerIdParams(raw: Record<string, unknown>): ICallerIdV2Params {
  if (raw.version === 2) return raw as unknown as ICallerIdV2Params;
  const next: ICallerIdV2Params = { version: 2 };
  const missing = raw.onMissing === 'empty' ? 'empty' : 'keep';
  if (raw.mode === 'directory')
    next.number = {
      source: {
        source: 'directory',
        directoryUid: Number(raw.directoryUid),
        valueFieldUid: Number(raw.valueFieldUid),
        keySource: (raw.keySource as CallValueSource) ?? { source: 'original_caller' },
        onMissing: 'keep',
      },
      onMissing: missing,
    };
  else if (raw.mode === 'number_list')
    next.number = {
      source: {
        source: 'number_list',
        listUid: Number(raw.list_uid),
        pick: 'mapping',
        keySource: { source: 'original_caller' },
      },
    };
  else if (raw.mode === 'carousel')
    next.number = {
      source: {
        source: 'pool',
        numbers: Array.isArray(raw.pool) ? raw.pool.map(String) : [],
        pick: 'random',
      },
    };
  else if (typeof raw.callerid === 'string' && raw.callerid)
    next.number = { source: { source: 'fixed', value: raw.callerid } };
  if (typeof raw.name === 'string' && raw.name)
    next.name = { source: { source: 'fixed', value: raw.name } };
  return next;
}
function transformText(input: string, t: DialRewriteTransform): string {
  let out = t.replaceAll !== undefined ? t.replaceAll : input;
  if (t.stripStartCount) out = Array.from(out).slice(t.stripStartCount).join('');
  if (t.stripStartText && out.startsWith(t.stripStartText))
    out = out.slice(t.stripStartText.length);
  if (t.stripEndCount)
    out = Array.from(out)
      .slice(0, Math.max(0, Array.from(out).length - t.stripEndCount))
      .join('');
  if (t.stripEndText && out.endsWith(t.stripEndText)) out = out.slice(0, -t.stripEndText.length);
  if (t.replaceFind) out = out.split(t.replaceFind).join(t.replaceWith ?? '');
  return (t.prefix ?? '') + out + (t.postfix ?? '');
}
function matchesText(input: string, c: DialRewriteCondition): boolean {
  if (c.kind === 'eq') return input === c.value;
  if (c.kind === 'startsWith') return input.startsWith(c.value ?? '');
  if (c.kind === 'endsWith') return input.endsWith(c.value ?? '');
  if (c.kind === 'length') {
    const length = Array.from(input).length;
    return (
      (c.min === undefined || length >= c.min) &&
      (c.max === undefined || length <= c.max) &&
      (c.value === undefined || length === Number(c.value))
    );
  }
  return false;
}
export function evaluateCallerIdName(
  input: string,
  rewrite?: DialTargetRewrite,
): { output: string; error?: string; matchedRuleId?: string } {
  if (!text(input) || (rewrite && !validRewrite(rewrite, 'name')))
    return { output: input, error: 'invalid_transform' };
  const rule = rewrite?.rules?.find(
    (r) => r.enabled !== false && (r.conditions ?? []).every((c) => matchesText(input, c)),
  );
  if (!rule && rewrite?.noMatch === 'reject') return { output: input, error: 'rejected' };
  const output = rule ? transformText(input, rule.transform) : input;
  return text(output)
    ? { output, matchedRuleId: rule?.id }
    : { output: input, error: 'invalid_transform' };
}

export function evaluateCallerIdNumber(input: string, rewrite?: DialTargetRewrite) {
  const result = evaluateDialTargetRewrite(input, rewrite, 'phone');
  return result.output.length > 79 ? { ...result, error: 'charset' as const } : result;
}
