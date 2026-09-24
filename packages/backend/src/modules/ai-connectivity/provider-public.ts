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
  for (const key of [
    'model', 'voice', 'language', 'language_code', 'reasoning_effort',
    'role', 'emotion', 'speed', 'folder_id', 'pitch_shift',
    'voice_name', 'speaking_rate', 'eou_sensitivity',
  ]) {
    const item = value?.defaults?.[key];
    if (typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item))) {
      defaults[key] = item;
    }
  }
  for (const key of ['temperature', 'max_tokens']) {
    if (typeof value?.defaults?.[key] === 'number' && Number.isFinite(value.defaults[key])) {
      defaults[key] = value.defaults[key];
    }
  }
  const secretConfigured = !!value?.encrypted_api_key;
  const authHeaderKeys = Array.isArray(value?.defaults?.authHeaderKeys)
    ? value.defaults.authHeaderKeys.filter((key: unknown) => typeof key === 'string' && key.trim())
    : [];
  return {
    uid: value?.uid, name: value?.name, kind: value?.kind, vendor: value?.vendor,
    endpoint: publicEndpoint(value?.endpoint), auth_type: value?.auth_type,
    capabilities: Array.isArray(value?.capabilities) ? value.capabilities : [],
    defaults, enabled: value?.enabled, user_uid: value?.user_uid,
    is_global: value?.is_global === true,
    secretConfigured, has_key: secretConfigured, authHeaderKeys,
    authSummary: { type: value?.auth_type, secretConfigured },
  };
}
