import type { CcAiProvider } from './ai-provider.model';

export type SpeechCapability = 'tts' | 'stt';

export interface LegacySpeechEngineRow {
  uid: number;
  name?: string | null;
  type?: string | null;
  token?: string | null;
  settings?: Record<string, unknown> | null;
  custom_url?: string | null;
  auth_mode?: string | null;
  custom_headers?: Record<string, string> | null;
}

export interface SpeechProviderInsert {
  name: string;
  kind: 'online' | 'local' | 'custom';
  vendor: string;
  endpoint: string;
  auth_type: 'none' | 'bearer' | 'custom';
  capabilities: SpeechCapability[];
  defaults: Record<string, unknown>;
  enabled: boolean;
  is_global: true;
  user_uid: 0;
  plainToken: string;
}

/** Runtime shape the Yandex/Google/custom factories already consume. */
export interface SpeechEngineConfig {
  uid: number;
  name: string;
  type: 'google' | 'yandex' | 'custom';
  token: string;
  settings: Record<string, any>;
  custom_url: string;
  auth_mode: string;
  custom_headers: Record<string, string>;
}

const AUTH_MODES = new Set(['none', 'bearer', 'custom']);

/** Built-in hosts. Yandex and Google engines never stored a custom URL of their own. */
export const HOSTED_SPEECH_ENDPOINTS: Record<SpeechCapability, Record<string, string>> = {
  tts: {
    yandex: 'https://tts.api.cloud.yandex.net',
    google: 'https://texttospeech.googleapis.com',
  },
  stt: {
    yandex: 'https://stt.api.cloud.yandex.net',
    google: 'https://speech.googleapis.com',
  },
};

export function hostedSpeechEndpoint(capability: SpeechCapability, vendor: string): string {
  return HOSTED_SPEECH_ENDPOINTS[capability]?.[vendor] || '';
}

/**
 * Old cabinet engines become superadmin catalog rows.
 * `legacyEngine` keeps the source uid so IVR, robots and routes can be rewritten.
 */
export function mapLegacySpeechEngine(
  row: LegacySpeechEngineRow,
  capability: SpeechCapability,
): SpeechProviderInsert {
  const type = String(row.type || 'custom').slice(0, 32);
  const settings = row.settings && typeof row.settings === 'object' ? { ...row.settings } : {};
  const customHeaders = row.custom_headers && typeof row.custom_headers === 'object'
    ? { ...row.custom_headers }
    : {};
  const plainToken = typeof row.token === 'string' ? row.token : '';
  const auth = AUTH_MODES.has(String(row.auth_mode))
    ? row.auth_mode as SpeechProviderInsert['auth_type']
    : 'bearer';
  const hosted = hostedSpeechEndpoint(capability, type);
  const endpoint = String(row.custom_url || hosted || '').slice(0, 512);
  let authType: SpeechProviderInsert['auth_type'] = plainToken ? auth : 'none';
  if (plainToken && authType === 'none' && type !== 'custom') authType = 'bearer';
  return {
    name: String(row.name || capability).slice(0, 128),
    kind: type === 'custom' ? 'custom' : 'online',
    vendor: type,
    endpoint,
    auth_type: authType,
    capabilities: [capability],
    defaults: {
      ...settings,
      customHeaders,
      legacyEngine: { kind: capability, uid: Number(row.uid) },
    },
    enabled: true,
    is_global: true,
    user_uid: 0,
    plainToken,
  };
}

/**
 * Fill the SpeechKit/Google address and bearer auth the old form never stored,
 * and keep the style the synthesizer reads as `role`.
 */
export function repairLegacySpeechProvider(current: {
  vendor: string;
  endpoint: string | null;
  auth_type: string | null;
  capabilities: unknown;
  defaults: Record<string, unknown> | null;
  hasKey: boolean;
}): { endpoint?: string; auth_type?: 'bearer'; defaults?: Record<string, unknown> } | null {
  let rawCaps = current.capabilities;
  if (typeof rawCaps === 'string') {
    try { rawCaps = JSON.parse(rawCaps); } catch { rawCaps = []; }
  }
  const caps = Array.isArray(rawCaps) ? rawCaps.map(String) : [];
  const capability: SpeechCapability | null = caps.includes('tts')
    ? 'tts'
    : caps.includes('stt')
      ? 'stt'
      : null;
  if (!capability || current.vendor === 'custom') return null;
  const patch: { endpoint?: string; auth_type?: 'bearer'; defaults?: Record<string, unknown> } = {};
  const endpoint = String(current.endpoint || '').trim()
    || hostedSpeechEndpoint(capability, current.vendor);
  if (endpoint && endpoint !== current.endpoint) patch.endpoint = endpoint;
  if (current.hasKey && (current.auth_type === 'none' || !current.auth_type)) {
    patch.auth_type = 'bearer';
  }
  const defaults = { ...(current.defaults ?? {}) };
  if (typeof defaults.role !== 'string' && typeof defaults.emotion === 'string' && defaults.emotion) {
    defaults.role = defaults.emotion;
    patch.defaults = defaults;
  }
  return Object.keys(patch).length ? patch : null;
}

/** Client saves see the public allowlist, which omits catalog bookkeeping. */
export function mergeCatalogDefaults(previous: unknown, incoming: unknown): Record<string, unknown> {
  const prev = previous && typeof previous === 'object' ? { ...(previous as Record<string, unknown>) } : {};
  const next = incoming && typeof incoming === 'object' ? incoming as Record<string, unknown> : {};
  const merged: Record<string, unknown> = { ...prev, ...next };
  if (prev.legacyEngine != null && next.legacyEngine == null) merged.legacyEngine = prev.legacyEngine;
  if (prev.customHeaders != null && next.customHeaders == null) merged.customHeaders = prev.customHeaders;
  if (prev.authHeaderKeys != null && next.authHeaderKeys == null) merged.authHeaderKeys = prev.authHeaderKeys;
  return merged;
}

export function legacyEngineKey(defaults: Record<string, unknown> | null | undefined): string | null {
  const legacy = defaults?.legacyEngine as { kind?: string; uid?: number } | undefined;
  if (!legacy || (legacy.kind !== 'tts' && legacy.kind !== 'stt')) return null;
  const uid = Number(legacy.uid);
  if (!Number.isInteger(uid) || uid <= 0) return null;
  return `${legacy.kind}:${uid}`;
}

export function toSpeechEngine(
  row: Pick<CcAiProvider, 'uid' | 'name' | 'vendor' | 'endpoint' | 'auth_type' | 'defaults'>,
  token: string,
): SpeechEngineConfig {
  const defaults = { ...(row.defaults ?? {}) };
  const customHeaders = defaults.customHeaders && typeof defaults.customHeaders === 'object'
    ? defaults.customHeaders as Record<string, string>
    : {};
  delete defaults.customHeaders;
  delete defaults.legacyEngine;
  if (typeof defaults.role !== 'string' && typeof defaults.emotion === 'string' && defaults.emotion) {
    defaults.role = defaults.emotion;
  }
  return {
    uid: row.uid,
    name: row.name,
    type: row.vendor === 'google' || row.vendor === 'yandex' ? row.vendor : 'custom',
    token,
    settings: defaults,
    custom_url: row.endpoint || '',
    auth_mode: row.auth_type || 'none',
    custom_headers: customHeaders,
  };
}

/**
 * Old engine uid → new provider uid.
 * A value that is already a provider uid (its legacy source differs) stays put,
 * so a second run does not chase the next engine that reused that number.
 */
export function remapSpeechUid(
  value: unknown,
  map: Map<number, number>,
  providerLegacyUid: Map<number, number> = new Map(),
): number | unknown {
  const uid = Number(value);
  if (!Number.isInteger(uid) || uid <= 0 || !map.has(uid)) return value;
  const alreadyFrom = providerLegacyUid.get(uid);
  if (alreadyFrom != null && alreadyFrom !== uid) return value;
  return map.get(uid);
}

export function rewriteIvrPrompts(
  prompts: unknown,
  ttsMap: Map<number, number>,
  providerLegacyUid?: Map<number, number>,
): unknown {
  if (!Array.isArray(prompts)) return prompts;
  return prompts.map((phrase) => {
    if (!phrase || typeof phrase !== 'object') return phrase;
    const row = phrase as { kind?: string; engine_uid?: unknown };
    if (row.kind !== 'tts') return phrase;
    return { ...row, engine_uid: remapSpeechUid(row.engine_uid, ttsMap, providerLegacyUid) };
  });
}

export function rewriteRouteActions(actions: unknown, maps: {
  tts: Map<number, number>;
  stt: Map<number, number>;
}, providerLegacyUid?: Map<number, number>): unknown {
  if (!Array.isArray(actions)) return actions;
  return actions.map((action) => {
    if (!action || typeof action !== 'object') return action;
    const row = action as { type?: string; params?: Record<string, unknown> };
    if (!row.params || typeof row.params !== 'object') return action;
    const params = { ...row.params };
    if (params.stt_engine_uid != null) {
      params.stt_engine_uid = remapSpeechUid(params.stt_engine_uid, maps.stt, providerLegacyUid);
    }
    if (row.type === 'text2speech' && params.engine != null) {
      params.engine = remapSpeechUid(params.engine, maps.tts, providerLegacyUid);
    }
    return { ...row, params };
  });
}

export function rewriteNotifyDispatch(
  raw: string | null,
  sttMap: Map<number, number>,
  providerLegacyUid?: Map<number, number>,
): string | null {
  if (!raw) return raw;
  try {
    const parsed = JSON.parse(raw) as { stt_engine_uid?: unknown };
    if (parsed.stt_engine_uid == null) return raw;
    parsed.stt_engine_uid = remapSpeechUid(parsed.stt_engine_uid, sttMap, providerLegacyUid);
    return JSON.stringify(parsed);
  } catch {
    return raw;
  }
}
