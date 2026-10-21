const PREFIX = 'krasterisk.modules.fresh.v1.';

export function freshStorageKey(identity: { uniqueid?: number; vpbx_user_uid?: number }, impersonationTenant?: number): string | null {
  const tenant = impersonationTenant ?? identity.vpbx_user_uid;
  if (!Number.isSafeInteger(identity.uniqueid) || (identity.uniqueid ?? 0) <= 0 || !Number.isSafeInteger(tenant) || (tenant ?? 0) <= 0) return null;
  return PREFIX + tenant + '.' + identity.uniqueid + (impersonationTenant === undefined ? '.user' : '.impersonated');
}

export function loadFreshCodes(key: string | null): string[] {
  if (!key) return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((code): code is string => typeof code === 'string' && code.length > 0 && code.length < 80);
  } catch {
    return [];
  }
}

export function saveFreshCodes(key: string | null, codes: string[]): void {
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(codes)); } catch { /* Memory-only when storage is unavailable. */ }
}
