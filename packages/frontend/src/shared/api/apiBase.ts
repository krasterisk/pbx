/** API root from env (may wrongly include `/public` on some builds). */
export function getApiBaseFromEnv(): string {
  return (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
}

/** Authenticated API — never `/api/public` (CDR, recordings, auth). */
export function getAuthApiBase(): string {
  return getApiBaseFromEnv().replace(/\/public$/, '');
}

export function isStandaloneApp(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.includes('standalone');
}

/** Same base as rtkApi in standalone (single `/public`, never `/public/public`). */
export function getEffectiveApiBase(): string {
  const env = getApiBaseFromEnv();
  if (!isStandaloneApp()) {
    return getAuthApiBase();
  }
  if (env.endsWith('/public')) {
    return env;
  }
  return `${env}/public`;
}
