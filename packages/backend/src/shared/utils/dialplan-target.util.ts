import type { ValueSource } from '@krasterisk/shared';
import { AsteriskDialplanUtils } from './dialplan.util';

export type TargetKind = 'queue' | 'exten' | 'group' | 'context';

/** Channel var set by toqueue phonebook lookup CURL (value-only response). */
export const PHONEBOOK_TARGET_VAR = 'PB_TARGET';

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
  if (typeof nested === 'string' && nested) return { source: 'fixed', value: nested };
  if (typeof legacyVal === 'string' && legacyVal) return { source: 'fixed', value: legacyVal };
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
