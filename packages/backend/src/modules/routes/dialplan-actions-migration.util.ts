import { liftDialTargetRewrite } from '@krasterisk/shared';

/**
 * Pure Phase-12 dialplan action rewrite (D-12 / D-20 / D-28 / D-51 / D-29).
 * No Sequelize, no I/O — the standalone script walks rows and calls this.
 */

export const USE_EXTEN_SENTINEL = '__USE_EXTEN__';

/**
 * `sendmail` / `sendmailpeer` / `telegram` are here because notify now routes
 * through a notification integration: there is no integration uid to infer from
 * a bare address, so folding them would produce rows that fail validation.
 */
export const UNMAPPED_HARD_REMOVE = new Set([
  'tofax', 'asr', 'keywords',
  'sendmail', 'sendmailpeer', 'telegram',
]);

const KNOWN_TYPES = new Set([
  'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
  'toivr', 'toroute', 'playprompt', 'playback', 'background',
  'setclid_custom', 'setclid_list',
  'notify', 'callerid',
  'voicemail', 'text2speech', 'voicerobot',
  'webhook', 'confbridge', 'cmd',
  'label', 'busy', 'hangup', 'congestion',
  'goto', 'branch', 'schedule', 'http_request', 'collect_input',
]);

const ADDRESS_STRING_FIELDS: Record<string, { from: string; to: string; useExtenField?: string }> = {
  toqueue: { from: 'queue', to: 'target' },
  toexten: { from: 'exten', to: 'target', useExtenField: 'useExten' },
  togroup: { from: 'group', to: 'target' },
  voicemail: { from: 'exten', to: 'target' },
  totrunk: { from: 'dest', to: 'dest' },
  toroute: { from: 'context', to: 'context' },
  confbridge: { from: 'room', to: 'room' },
};

export interface MigrateActionResult {
  action: unknown;
  changed: boolean;
  unmapped?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValueSource(value: unknown): boolean {
  return isPlainObject(value) && typeof value.source === 'string';
}

function isRoutePatternToken(value: string): boolean {
  return value === USE_EXTEN_SENTINEL || value === '' || value === '${EXTEN}';
}

function toValueSource(raw: unknown, useExten?: unknown): { source: string; value?: string } {
  if (useExten) return { source: 'route_pattern' };
  if (typeof raw === 'string') {
    return isRoutePatternToken(raw) ? { source: 'route_pattern' } : { source: 'fixed', value: raw };
  }
  return { source: 'route_pattern' };
}

function liftAddressFields(
  type: string,
  params: Record<string, unknown>,
): { params: Record<string, unknown>; changed: boolean } {
  const spec = ADDRESS_STRING_FIELDS[type];
  if (!spec) return { params, changed: false };

  const current = params[spec.to];
  if (isValueSource(current)) {
    const next = { ...params };
    let changed = false;
    if (spec.from !== spec.to && spec.from in next) {
      delete next[spec.from];
      changed = true;
    }
    if (spec.useExtenField && spec.useExtenField in next) {
      delete next[spec.useExtenField];
      changed = true;
    }
    return { params: next, changed };
  }

  const fromVal = spec.from in params ? params[spec.from] : current;
  const useExten = spec.useExtenField ? params[spec.useExtenField] : undefined;
  const hasLegacy =
    spec.from in params
    || (typeof current === 'string')
    || Boolean(useExten);

  if (!hasLegacy && current !== undefined && current !== null) {
    return { params, changed: false };
  }

  if (!hasLegacy && current === undefined) {
    return { params, changed: false };
  }

  const next = { ...params };
  next[spec.to] = toValueSource(fromVal ?? current, useExten);
  if (spec.from !== spec.to) delete next[spec.from];
  if (spec.useExtenField) delete next[spec.useExtenField];
  return { params: next, changed: true };
}

/**
 * Types merged into a single app with a discriminator param: busy/congestion
 * into hangup(signal), branch into goto(condition), setclid_* into
 * callerid(mode).
 */
function foldMergedTypes(
  type: string,
  params: Record<string, unknown>,
): { type: string; params: Record<string, unknown>; changed: boolean } | null {
  if (type === 'busy' || type === 'congestion') {
    return { type: 'hangup', params: { ...params, signal: type }, changed: true };
  }
  if (type === 'hangup' && params.signal == null) {
    return { type: 'hangup', params: { ...params, signal: 'hangup' }, changed: true };
  }
  if (type === 'branch') {
    const { true_label, ...rest } = params;
    return {
      type: 'goto',
      params: { ...rest, label_name: true_label ?? params.label_name ?? '' },
      changed: true,
    };
  }
  if (type === 'setclid_custom') {
    const { mode, ...rest } = params;
    return { type: 'callerid', params: { ...rest, mode: 'static' }, changed: true };
  }
  if (type === 'setclid_list') {
    const { mode, ...rest } = params;
    return { type: 'callerid', params: { ...rest, mode: 'number_list' }, changed: true };
  }
  if (type === 'callerid' && params.mode === 'setclid_list') {
    return { type: 'callerid', params: { ...params, mode: 'number_list' }, changed: true };
  }
  return null;
}

function foldPlayback(
  type: string,
  params: Record<string, unknown>,
): { type: string; params: Record<string, unknown>; changed: boolean } | null {
  if (type === 'playprompt') {
    return { type: 'playback', params: { ...params, mode: params.mode ?? 'plain' }, changed: true };
  }
  if (type === 'background') {
    return { type: 'playback', params: { ...params, mode: params.mode ?? 'menu' }, changed: true };
  }
  if (type === 'playback' && params.mode == null) {
    return { type: 'playback', params: { ...params, mode: 'control' }, changed: true };
  }
  return null;
}

function liftQueuePriority(
  type: string,
  params: Record<string, unknown>,
): { params: Record<string, unknown>; changed: boolean } {
  if (type !== 'toqueue') return { params, changed: false };
  const raw = params.priority;
  if (raw == null || raw === '') return { params, changed: false };
  if (isValueSource(raw)) return { params, changed: false };
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return {
      params: { ...params, priority: { source: 'fixed', value: String(Math.trunc(raw)) } },
      changed: true,
    };
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return { params, changed: false };
    return {
      params: { ...params, priority: { source: 'fixed', value: String(n) } },
      changed: true,
    };
  }
  return { params, changed: false };
}

/**
 * Rewrite one stored action onto the Phase-12 params model.
 * Unmapped hard-remove types (asr/tofax/keywords) and unknown types stay as-is.
 */
export function migrateAction(action: unknown): MigrateActionResult {
  if (!isPlainObject(action) || typeof action.type !== 'string') {
    return { action, changed: false };
  }

  const type = action.type;
  const params = isPlainObject(action.params) ? { ...action.params } : {};

  if (UNMAPPED_HARD_REMOVE.has(type)) {
    return { action, changed: false, unmapped: type };
  }

  const playback = foldPlayback(type, params);
  const merged = playback ? null : foldMergedTypes(type, params);

  let nextType = playback?.type ?? merged?.type ?? type;
  let nextParams = playback?.params ?? merged?.params ?? params;
  let changed = Boolean(playback?.changed || merged?.changed);

  const lifted = liftAddressFields(nextType, nextParams);
  nextParams = lifted.params;
  if (lifted.changed) changed = true;

  const prioLift = liftQueuePriority(nextType, nextParams);
  nextParams = prioLift.params;
  if (prioLift.changed) changed = true;

  if (nextType === 'trunk_carousel') {
    nextType = 'totrunk';
    nextParams = {
      trunkMode: 'carousel',
      ...nextParams,
    };
    changed = true;
  }

  if (['totrunk', 'toexten', 'tolist', 'toroute'].includes(nextType)) {
    const rewriteLift = liftDialTargetRewrite(nextParams);
    nextParams = rewriteLift.params;
    if (rewriteLift.changed) changed = true;
  }

  if (!changed) {
    if (!KNOWN_TYPES.has(type)) {
      return { action, changed: false, unmapped: type };
    }
    return { action, changed: false };
  }

  const nextAction = { ...action, type: nextType, params: nextParams };
  return { action: nextAction, changed: true };
}

export interface ChainMigrationResult {
  value: unknown;
  changed: boolean;
  converted: number;
  unmapped: Array<{ type: string; index: number }>;
}

/** Apply `migrateAction` to every element of an action chain (or a lone action). */
export function migrateActionChain(
  value: unknown,
  migrate: typeof migrateAction = migrateAction,
): ChainMigrationResult {
  if (value == null) {
    return { value, changed: false, converted: 0, unmapped: [] };
  }
  const items = Array.isArray(value) ? value : [value];
  const unmapped: Array<{ type: string; index: number }> = [];
  let converted = 0;
  let changed = false;
  const next = items.map((item, index) => {
    const result = migrate(item);
    if (result.unmapped) unmapped.push({ type: result.unmapped, index });
    if (result.changed) {
      converted += 1;
      changed = true;
    }
    return result.action;
  });
  return {
    value: Array.isArray(value) ? next : next[0],
    changed,
    converted,
    unmapped,
  };
}
