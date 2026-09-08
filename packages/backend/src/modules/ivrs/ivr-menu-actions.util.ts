import { toPublicExten } from '../../shared/utils/tenant-public-id.util';
import { migrateAction } from '../routes/dialplan-actions-migration.util';
import { ActionTypesList } from '../routes/dto/route-action.dto';

export type VoiceMenuDestKind = 'context' | 'extension' | 'queue' | 'menu' | 'group';

export interface DigitDestination {
  kind: VoiceMenuDestKind;
  target: string;
}

export interface IvrMenuItem {
  digit: string;
  actions: Array<Record<string, unknown>>;
}

export interface IvrActionAlias {
  digit: string;
  from: string;
  to: string;
}

export interface IvrUnmappedAction {
  digit: string;
  type: string;
}

export interface NormalizeIvrMenuResult {
  items: IvrMenuItem[];
  aliases: IvrActionAlias[];
  unmapped: IvrUnmappedAction[];
}

/** Agent / leftover names that are not ActionType and must not be persisted. */
export const IVR_ACTION_ALIASES: Record<string, string> = {
  dial: 'toexten',
  toendpoint: 'toexten',
  toextension: 'toexten',
  tocontext: 'toroute',
};

const KNOWN_ACTION_TYPES = new Set<string>(ActionTypesList);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asIvrDestination(value: unknown): DigitDestination {
  const rec = isPlainObject(value) ? value : {};
  return {
    kind: String(rec.kind || 'queue') as VoiceMenuDestKind,
    target: String(rec.target ?? ''),
  };
}

export function actionFromIvrDestination(
  dest: DigitDestination,
  opts: { digit?: string; index?: number } = {},
): Record<string, unknown> {
  const digit = opts.digit ?? 'x';
  const index = opts.index ?? 0;
  const condition = {};
  if (dest.kind === 'queue') {
    return typedAction('toqueue', {
      digit,
      index,
      params: { target: { source: 'fixed', value: toPublicExten(dest.target) } },
      condition,
    });
  }
  if (dest.kind === 'menu') {
    return typedAction('toivr', {
      digit,
      index,
      params: { ivr_uid: Number(dest.target) || dest.target },
      condition,
    });
  }
  if (dest.kind === 'extension') {
    return typedAction('toexten', {
      digit,
      index,
      params: {
        target: { source: 'fixed', value: toPublicExten(dest.target) },
        webrtc: true,
      },
      condition,
    });
  }
  if (dest.kind === 'group') {
    return typedAction('togroup', {
      digit,
      index,
      params: { target: { source: 'fixed', value: String(dest.target) } },
      condition,
    });
  }
  return typedAction('toroute', {
    digit,
    index,
    params: { context: dest.target },
    condition,
  });
}

export function asIvrMenuItems(value: unknown): IvrMenuItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const rec = isPlainObject(item) ? item : {};
    let actions = Array.isArray(rec.actions)
      ? rec.actions.filter((row) => isPlainObject(row))
      : [];
    if (!actions.length && rec.destination) {
      const dest = asIvrDestination(rec.destination);
      actions = [actionFromIvrDestination(dest, { digit: String(rec.digit ?? '') })];
    }
    return { digit: String(rec.digit ?? ''), actions };
  });
}

export function destinationFromIvrActions(actions: unknown): DigitDestination | null {
  if (!Array.isArray(actions)) return null;
  for (const action of actions) {
    if (!isPlainObject(action)) continue;
    const type = String(action.type || '');
    const params = isPlainObject(action.params) ? action.params : {};
    if (type === 'toqueue') {
      return { kind: 'queue', target: String(targetValueFromParams(params) ?? '') };
    }
    if (type === 'toivr') {
      return { kind: 'menu', target: String(params.ivr_uid ?? '') };
    }
    if (type === 'toexten' || type === 'dial' || type === 'toendpoint' || type === 'toextension') {
      return { kind: 'extension', target: String(targetValueFromParams(params) ?? params.extension ?? '') };
    }
    if (type === 'toroute') {
      return { kind: 'context', target: String(params.context ?? targetValueFromParams(params) ?? '') };
    }
    if (type === 'goto' || type === 'tocontext') {
      if (params.context || params.context_name) {
        return { kind: 'context', target: String(params.context ?? params.context_name ?? '') };
      }
    }
    if (type === 'togroup') {
      return { kind: 'group', target: String(params.group ?? targetValueFromParams(params) ?? '') };
    }
  }
  return null;
}

export function targetValueFromParams(params: Record<string, unknown>): unknown {
  const target = params.target;
  if (typeof target === 'string' || typeof target === 'number') return target;
  if (isPlainObject(target) && target.value != null) return target.value;
  return params.queue ?? params.group;
}

export function normalizeIvrMenuItems(value: unknown, tenantUid?: number): NormalizeIvrMenuResult {
  const parsed = asIvrMenuItems(value);
  const aliases: IvrActionAlias[] = [];
  const unmapped: IvrUnmappedAction[] = [];
  const items = parsed.map((item) => {
    const actions = item.actions.map((action, index) => {
      const result = normalizeOneIvrAction(action, item.digit, index, tenantUid);
      if (result.alias) aliases.push({ digit: item.digit, ...result.alias });
      if (result.unmapped) unmapped.push({ digit: item.digit, type: result.unmapped });
      return result.action;
    });
    return { digit: item.digit, actions };
  });
  return { items, aliases, unmapped };
}

export function summarizeIvrMenu(value: unknown): string {
  return asIvrMenuItems(value)
    .map((item) => {
      const types = item.actions.map((action) => String(action.type || '?')).join('+') || 'none';
      return `${item.digit}:${types}`;
    })
    .join(',') || '(empty)';
}

function typedAction(
  type: string,
  opts: { digit: string; index: number; params: Record<string, unknown>; condition: Record<string, unknown> },
): Record<string, unknown> {
  return {
    id: actionId(undefined, opts.digit, opts.index, type),
    type,
    params: opts.params,
    condition: opts.condition,
  };
}

function normalizeOneIvrAction(
  action: Record<string, unknown>,
  digit: string,
  index: number,
  tenantUid?: number,
): { action: Record<string, unknown>; alias?: { from: string; to: string }; unmapped?: string } {
  const fromType = String(action.type || '');
  let type = IVR_ACTION_ALIASES[fromType] ?? fromType;
  let params = isPlainObject(action.params) ? { ...action.params } : {};

  if (type === 'goto' && params.context && !params.label_name) {
    type = 'toroute';
  }

  const migrated = migrateAction({ ...action, type, params });
  const next = isPlainObject(migrated.action) ? migrated.action : { ...action, type, params };
  type = String(next.type || type);
  params = isPlainObject(next.params) ? { ...next.params } : params;

  if (type === 'toexten' || type === 'toqueue') {
    params = publicizeFixedTarget(params, tenantUid);
  }
  if (type === 'toroute') {
    params = flattenTorouteContext(params);
  }
  if (type === 'toexten' && params.webrtc == null) {
    params = { ...params, webrtc: true };
  }

  const normalized = {
    id: actionId(action.id, digit, index, type || 'unknown'),
    type,
    params,
    condition: isPlainObject(action.condition) ? action.condition : (isPlainObject(next.condition) ? next.condition : {}),
  };

  if (!type || !KNOWN_ACTION_TYPES.has(type) || migrated.unmapped) {
    return {
      action: normalized,
      alias: fromType && fromType !== type ? { from: fromType, to: type } : undefined,
      unmapped: migrated.unmapped || type || 'unknown',
    };
  }

  return {
    action: normalized,
    alias: fromType && fromType !== type ? { from: fromType, to: type } : undefined,
  };
}

function flattenTorouteContext(params: Record<string, unknown>): Record<string, unknown> {
  const context = params.context;
  if (isPlainObject(context) && context.value != null) {
    return { ...params, context: String(context.value) };
  }
  return params;
}

function publicizeFixedTarget(params: Record<string, unknown>, tenantUid?: number): Record<string, unknown> {
  const target = params.target;
  if (!isPlainObject(target) || target.source !== 'fixed' || target.value == null) {
    return params;
  }
  return {
    ...params,
    target: { ...target, value: toPublicExten(target.value, tenantUid) },
  };
}

function actionId(existing: unknown, digit: string, index: number, type: string): string {
  if (typeof existing === 'string' && existing.trim()) return existing;
  const safeDigit = String(digit || 'x').replace(/[^0-9a-zA-Z_*#tTiI]/g, '') || 'x';
  return `ivr-${safeDigit}-${index}-${type}`;
}
