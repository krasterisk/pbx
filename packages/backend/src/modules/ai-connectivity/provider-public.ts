/** Explicit allowlist for provider management responses; no ciphertext or arbitrary JSON keys. */
function publicEndpoint(endpoint: unknown): string {
  if (typeof endpoint !== 'string') return '';
  try {
    const url = new URL(endpoint);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return endpoint.split(/[?#]/, 1)[0].replace(/\/\/[^/@]+@/, '//');
  }
}

export function publicProvider(row: any): Record<string, unknown> {
  const value = typeof row?.get === 'function' ? row.get({ plain: true }) : row;
  const defaults: Record<string, string | number> = {};
  for (const key of ['model', 'voice', 'language', 'reasoning_effort']) {
    if (typeof value?.defaults?.[key] === 'string') defaults[key] = value.defaults[key];
  }
  for (const key of ['temperature', 'max_tokens']) {
    if (typeof value?.defaults?.[key] === 'number' && Number.isFinite(value.defaults[key])) {
      defaults[key] = value.defaults[key];
    }
  }
  const pricing: Record<string, number> = {};
  for (const key of ['inputTokenUsd', 'outputTokenUsd', 'audioMinuteUsd']) {
    if (typeof value?.pricing?.[key] === 'number' && Number.isFinite(value.pricing[key])) {
      pricing[key] = value.pricing[key];
    }
  }
  const secretConfigured = !!value?.encrypted_api_key;
  return {
    uid: value?.uid, name: value?.name, kind: value?.kind, vendor: value?.vendor,
    endpoint: publicEndpoint(value?.endpoint), auth_type: value?.auth_type,
    capabilities: Array.isArray(value?.capabilities) ? value.capabilities : [],
    defaults, pricing, enabled: value?.enabled, user_uid: value?.user_uid,
    secretConfigured, has_key: secretConfigured,
    authSummary: { type: value?.auth_type, secretConfigured },
  };
}
