/** Legacy scripted-robot Stasis application (override with ARI_APP_NAME). */
export const DEFAULT_ARI_APP_NAME = 'krasterisk_voicerobots';

/** Dedicated Stasis application for autodial lifecycle events. */
export const DEFAULT_AUTODIAL_ARI_APP_NAME = 'krasterisk_autodial';

export interface AriApplicationNames {
  scriptedVoiceRobots: string;
  autodial: string;
}

/**
 * Stasis app name from env or ConfigService.
 * Only [A-Za-z0-9_-] — empty / invalid falls back to the default.
 */
export function resolveAriAppName(raw?: string | null): string {
  const name = (raw ?? process.env.ARI_APP_NAME ?? '').trim();
  return sanitizeAriAppName(name, DEFAULT_ARI_APP_NAME);
}

export function resolveAutodialAriAppName(raw?: string | null): string {
  const name = (raw ?? process.env.ARI_AUTODIAL_APP_NAME ?? '').trim();
  return sanitizeAriAppName(name, DEFAULT_AUTODIAL_ARI_APP_NAME);
}

/**
 * Resolve the applications served by this process. Asterisk allows one
 * WebSocket subscriber per Stasis application, so silently sharing a name
 * would make ownership dependent on connection order.
 */
export function resolveAriApplicationNames(input?: {
  scriptedVoiceRobots?: string | null;
  autodial?: string | null;
}): AriApplicationNames {
  const names = {
    scriptedVoiceRobots: resolveAriAppName(input?.scriptedVoiceRobots),
    autodial: resolveAutodialAriAppName(input?.autodial),
  };
  if (names.scriptedVoiceRobots === names.autodial) {
    throw new Error('ARI scripted-robot and autodial application names must differ');
  }
  return names;
}

function sanitizeAriAppName(name: string, fallback: string): string {
  const sanitized = name.replace(/[^A-Za-z0-9_-]/g, '');
  return sanitized || fallback;
}
