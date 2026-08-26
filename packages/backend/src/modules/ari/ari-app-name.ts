/** Default Stasis / ARI application name (override with ARI_APP_NAME). */
export const DEFAULT_ARI_APP_NAME = 'krasterisk_voicerobots';

/**
 * Stasis app name from env or ConfigService.
 * Only [A-Za-z0-9_-] — empty / invalid falls back to the default.
 */
export function resolveAriAppName(raw?: string | null): string {
  const name = (raw ?? process.env.ARI_APP_NAME ?? '').trim();
  const sanitized = name.replace(/[^A-Za-z0-9_-]/g, '');
  return sanitized || DEFAULT_ARI_APP_NAME;
}
