/**
 * Pure Phase-12 dialplan action rewrite (D-12 / D-20 / D-28 / D-51 / D-29).
 * No Sequelize, no I/O — the standalone script walks rows and calls this.
 */

export const USE_EXTEN_SENTINEL = '__USE_EXTEN__';

const UNMAPPED_HARD_REMOVE = new Set(['tofax', 'asr', 'keywords']);

const KNOWN_TYPES = new Set([
  'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
  'toivr', 'toroute', 'playprompt', 'playback', 'background',
  'setclid_custom', 'setclid_list',
  'sendmail', 'sendmailpeer', 'telegram',
  'notify', 'callerid', 'trunk_carousel',
  'voicemail', 'text2speech', 'voicerobot',
  'webhook', 'confbridge', 'cmd',
  'label', 'busy', 'hangup', 'congestion',
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

function foldNotify(
  type: string,
  params: Record<string, unknown>,
): { type: string; params: Record<string, unknown>; changed: boolean } | null {
  if (type === 'sendmail') {
    const { email, text, subject, ...rest } = params;
    const recipients = isPlainObject(rest.recipients) ? { ...rest.recipients } : {};
    if (typeof email === 'string') recipients.email = email;
    const next: Record<string, unknown> = {
      ...rest,
      channels: Array.isArray(rest.channels) ? rest.channels : ['email'],
      recipients,
    };
    if (subject !== undefined) next.subject = subject;
    if (text !== undefined && next.body === undefined) next.body = text;
    return { type: 'notify', params: next, changed: true };
  }
  if (type === 'sendmailpeer') {
    const { exten, text, ...rest } = params;
    const recipients = isPlainObject(rest.recipients) ? { ...rest.recipients } : {};
    if (typeof exten === 'string') recipients.email = exten;
    const next: Record<string, unknown> = {
      ...rest,
      channels: Array.isArray(rest.channels) ? rest.channels : ['email'],
      recipients,
    };
    if (text !== undefined && next.body === undefined) next.body = text;
    return { type: 'notify', params: next, changed: true };
  }
  if (type === 'telegram') {
    const { chat_id, text, ...rest } = params;
    const recipients = isPlainObject(rest.recipients) ? { ...rest.recipients } : {};
    if (typeof chat_id === 'string') recipients.telegram = chat_id;
    const next: Record<string, unknown> = {
      ...rest,
      channels: Array.isArray(rest.channels) ? rest.channels : ['telegram'],
      recipients,
    };
    if (text !== undefined && next.body === undefined) next.body = text;
    return { type: 'notify', params: next, changed: true };
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
  const notify = playback ? null : foldNotify(type, params);

  let nextType = playback?.type ?? notify?.type ?? type;
  let nextParams = playback?.params ?? notify?.params ?? params;
  let changed = Boolean(playback?.changed || notify?.changed);

  const lifted = liftAddressFields(nextType, nextParams);
  nextParams = lifted.params;
  if (lifted.changed) changed = true;

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
