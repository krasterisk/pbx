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
