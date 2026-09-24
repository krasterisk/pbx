import type { ISttEngine, ITtsEngine } from '@/entities/engines';
import type { IAiProvider } from '../endpoints/aiAgentsApi';

const ENGINE_TYPES = new Set(['google', 'yandex', 'custom']);

/** Vendor and defaults become the shape TTS settings and engine selects already read. */
export function providerAsEngine(row: IAiProvider): ITtsEngine & ISttEngine {
  const defaults = { ...(row.defaults ?? {}) };
  const customHeaders = defaults.customHeaders && typeof defaults.customHeaders === 'object'
    ? defaults.customHeaders as Record<string, string>
    : {};
  delete defaults.customHeaders;
  delete defaults.legacyEngine;
  const vendor = ENGINE_TYPES.has(row.vendor) ? row.vendor : 'custom';
  return {
    uid: row.uid,
    name: row.name,
    type: vendor as ITtsEngine['type'],
    token: '',
    settings: defaults,
    custom_url: row.endpoint || '',
    auth_mode: (row.auth_type === 'custom' || row.auth_type === 'none' || row.auth_type === 'bearer')
      ? row.auth_type
      : 'bearer',
    custom_headers: customHeaders,
    user_uid: row.user_uid ?? 0,
  };
}
