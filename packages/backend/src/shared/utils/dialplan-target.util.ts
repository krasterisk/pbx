import type { ValueSource } from '@krasterisk/shared';
import { AsteriskDialplanUtils } from './dialplan.util';

export type TargetKind = 'queue' | 'exten' | 'group' | 'context';

/** Channel var set by toqueue phonebook lookup CURL (value-only response). */
export const PHONEBOOK_TARGET_VAR = 'PB_TARGET';

/** Channel var for toqueue priority phonebook lookup (separate from queue name). */
export const PHONEBOOK_PRIO_VAR = 'PB_PRIO';

export function resolveValueSource(
  params: Record<string, any> | undefined,
  field: string,
  legacy?: { stringField?: string; useExtenField?: string },
): ValueSource {
  const p = params ?? {};
  const nested = p[field];
  if (nested && typeof nested === 'object' && typeof nested.source === 'string') {
    return nested as ValueSource;
  }
  if (legacy?.useExtenField && p[legacy.useExtenField]) {
    return { source: 'route_pattern' };
  }
  const legacyVal = legacy?.stringField ? p[legacy.stringField] : undefined;
  if (typeof nested === 'string') {
    if (nested === '${EXTEN}' || nested === '__USE_EXTEN__' || nested === '') {
      return { source: 'route_pattern' };
    }
    return { source: 'fixed', value: nested };
  }
  if (typeof legacyVal === 'string') {
    if (legacyVal === '${EXTEN}' || legacyVal === '__USE_EXTEN__' || legacyVal === '') {
      return { source: 'route_pattern' };
    }
    return { source: 'fixed', value: legacyVal };
  }
  return { source: 'route_pattern' };
}

export function resolveQueueValueSource(params: Record<string, any> | undefined): ValueSource {
  const p = params ?? {};
  if (p.target && typeof p.target === 'object' && typeof p.target.source === 'string') {
    return p.target as ValueSource;
  }
  const queue = typeof p.queue === 'string' ? p.queue : '';
  if (queue) return { source: 'fixed', value: queue };
  return { source: 'route_pattern' };
}

/**
 * Dual-read queue priority: ValueSource, legacy number, or numeric string.
 * `route_pattern` is not valid for QUEUE_PRIO.
 */
export function resolveQueuePriority(
  params: Record<string, any> | undefined,
): ValueSource | undefined {
  const raw = params?.priority;
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { source: 'fixed', value: String(Math.trunc(raw)) };
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return undefined;
    return { source: 'fixed', value: String(n) };
  }
  if (raw && typeof raw === 'object' && typeof raw.source === 'string') {
    const src = raw as ValueSource;
    if (src.source === 'route_pattern') return undefined;
    if (src.source === 'fixed') {
      if (!String(src.value ?? '').trim()) return undefined;
      return src;
    }
    if (src.source === 'variable') {
      if (!String(src.name ?? '').trim()) return undefined;
      return src;
    }
    if (src.source === 'phonebook') {
      if (!(Number(src.phonebookUid) > 0) || !String(src.varKey ?? '').trim()) return undefined;
      return src;
    }
  }
  return undefined;
}

/** Right-hand side of Set(QUEUE_PRIO=…). */
export function queuePriorityExpr(src: ValueSource): string | undefined {
  if (src.source === 'fixed') {
    const n = parseInt(String(src.value), 10);
    if (!Number.isFinite(n)) return undefined;
    return String(n);
  }
  if (src.source === 'variable') {
    const name = AsteriskDialplanUtils.sanitizeDialplanInput(src.name);
    return name ? `\${${name}}` : undefined;
  }
  if (src.source === 'phonebook') {
    return `\${${PHONEBOOK_PRIO_VAR}}`;
  }
  return undefined;
}

export function buildPhonebookLookupSet(
  channelVar: string,
  phonebookUid: string,
  varKey: string,
  backendBaseUrl: string,
  dialplanApiKey: string,
): string {
  const keyParam = dialplanApiKey ? `&api_key=${encodeURIComponent(dialplanApiKey)}` : '';
  const lookupUrl =
    `${backendBaseUrl}/internal/dialplan/phonebook-lookup` +
    `?phonebook_uid=${phonebookUid}&var_key=${encodeURIComponent(varKey)}${keyParam}`;
  return `Set(${channelVar}=\${CURL(${lookupUrl}&number=\${URIENCODE(\${CALLERID(num)})})})`;
}

export function normalizeTarget(
  kind: TargetKind,
  src: ValueSource,
  uid: number,
  opts?: { webrtc?: boolean },
): string {
  const raw =
    src.source === 'fixed'
      ? AsteriskDialplanUtils.sanitizeDialplanInput(src.value)
      : src.source === 'route_pattern'
        ? '${EXTEN}'
        : src.source === 'variable'
          ? `\${${AsteriskDialplanUtils.sanitizeDialplanInput(src.name)}}`
          : `\${${PHONEBOOK_TARGET_VAR}}`;

  switch (kind) {
    case 'queue': {
      // Legacy QueueApp stored the already-scoped Asterisk name (q{exten}_{uid}).
      if (new RegExp(`^q.+_${uid}$`).test(raw)) return raw;
      return `q${raw}_${uid}`;
    }
    case 'group':
      return `group_${raw}_${uid}`;
    case 'exten':
      return AsteriskDialplanUtils.pjsipDialTarget(raw, uid, { webrtc: opts?.webrtc !== false });
    case 'context': {
      const suffix = String(uid);
      return raw.endsWith(suffix) ? raw : `${raw}${suffix}`;
    }
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}
