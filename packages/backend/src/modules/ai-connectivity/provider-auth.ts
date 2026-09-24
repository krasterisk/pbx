/** Ciphertext prefix so a custom header map is not treated as a bearer token. */
export const CUSTOM_AUTH_PREFIX = 'headers:';

export function encodeCustomAuth(headers: Record<string, string>): string {
  return CUSTOM_AUTH_PREFIX + JSON.stringify(headers);
}

export function parseCustomAuth(secret: string): Record<string, string> {
  const raw = secret.startsWith(CUSTOM_AUTH_PREFIX) ? secret.slice(CUSTOM_AUTH_PREFIX.length) : secret;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && key.trim()) out[key.trim()] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function headerKeysOf(defaults: unknown): string[] {
  const keys = defaults && typeof defaults === 'object'
    ? (defaults as { authHeaderKeys?: unknown }).authHeaderKeys
    : undefined;
  if (!Array.isArray(keys)) return [];
  return keys
    .filter((key): key is string => typeof key === 'string' && key.trim().length > 0)
    .map((key) => key.trim());
}

/**
 * Put the stored secret on the outbound request.
 * bearer → Authorization, legacy api_key_header → X-API-Key,
 * custom → the header map encrypted with the connection.
 */
export function applyProviderAuth(
  headers: Record<string, string>,
  authType: string | null | undefined,
  secret: string | null | undefined,
): Record<string, string> {
  const next = { ...headers };
  const auth = authType || 'none';
  const value = secret ?? '';
  if (auth === 'none' || !value) return next;
  if (auth === 'bearer') {
    next.Authorization = `Bearer ${value}`;
    return next;
  }
  if (auth === 'api_key_header') {
    next['X-API-Key'] = value;
    return next;
  }
  if (auth === 'custom') {
    for (const [key, headerValue] of Object.entries(parseCustomAuth(value))) {
      if (headerValue) next[key] = headerValue;
    }
  }
  return next;
}

/** Blank values keep the previously stored secret for that header name. */
export function sealCustomAuth(
  previousAuth: string | null | undefined,
  previousPlain: string,
  incoming: Array<{ key?: string; value?: string }>,
): { plain: string; keys: string[] } {
  const prev = previousAuth === 'custom'
    ? parseCustomAuth(previousPlain)
    : previousAuth === 'api_key_header' && previousPlain
      ? { 'X-API-Key': previousPlain }
      : {};
  const next: Record<string, string> = {};
  for (const row of incoming) {
    const key = String(row.key ?? '').trim();
    if (!key) continue;
    const value = String(row.value ?? '');
    if (value.trim()) next[key] = value;
    else if (prev[key]) next[key] = prev[key];
  }
  return { plain: encodeCustomAuth(next), keys: Object.keys(next) };
}
