import { Preferences } from '@capacitor/preferences';

/**
 * Build flavors for API/WSS hosts (NAV-11 / D-34).
 * Runtime override is for on-prem/debug only — do not expose in production UI without ADMIN.
 */
export type UrlFlavor = 'dev' | 'staging' | 'prod';

export const API_URL_OVERRIDE_KEY = 'apiUrlOverride';
export const WSS_URL_OVERRIDE_KEY = 'wssUrlOverride';

const FLAVOR_API_DEFAULTS: Record<UrlFlavor, string> = {
  dev: '/api',
  staging: 'https://staging.krasterisk.local/api',
  prod: 'https://api.krasterisk.local/api',
};

const FLAVOR_WSS_DEFAULTS: Record<UrlFlavor, string> = {
  dev: '',
  staging: 'wss://staging.krasterisk.local/socket.io',
  prod: 'wss://api.krasterisk.local/socket.io',
};

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export type ResolveUrlOptions = {
  /** Runtime override (Preferences / debug). Wins over env. */
  override?: string | null;
  envApiUrl?: string;
  envWssUrl?: string;
};

/** Prefers runtime override → VITE_API_URL → flavor default. */
export function resolveApiBaseUrl(
  flavor: UrlFlavor,
  options: ResolveUrlOptions = {},
): string {
  const override = options.override?.trim();
  if (override) return stripTrailingSlash(override);

  const env = (options.envApiUrl ?? import.meta.env.VITE_API_URL ?? '').trim();
  if (env) return stripTrailingSlash(env);

  return stripTrailingSlash(FLAVOR_API_DEFAULTS[flavor]);
}

/** Prefers runtime override → VITE_WSS_URL → flavor default. */
export function resolveWssUrl(
  flavor: UrlFlavor,
  options: ResolveUrlOptions = {},
): string {
  const override = options.override?.trim();
  if (override) return stripTrailingSlash(override);

  const env = (options.envWssUrl ?? import.meta.env.VITE_WSS_URL ?? '').trim();
  if (env) return stripTrailingSlash(env);

  return stripTrailingSlash(FLAVOR_WSS_DEFAULTS[flavor]);
}

/** Optional Preferences-backed override (debug/on-prem). */
export async function getRuntimeApiUrlOverride(): Promise<string | null> {
  const { value } = await Preferences.get({ key: API_URL_OVERRIDE_KEY });
  return value?.trim() || null;
}

export async function getRuntimeWssUrlOverride(): Promise<string | null> {
  const { value } = await Preferences.get({ key: WSS_URL_OVERRIDE_KEY });
  return value?.trim() || null;
}
