import type { UserLevel } from '@krasterisk/shared';
import type { HubModuleRow } from '../types';
import { filterPagesByLevel } from './moduleRegistry';
import { moduleHubPath } from './navigation';

export type NavigationVisit = { id: string; path: string };
export type NavigationHistory = Record<string, NavigationVisit>;
const PREFIX = 'krasterisk.navigation.v1.';

export function navigationStorageKey(identity: { uniqueid?: number; vpbx_user_uid?: number }, impersonationTenant?: number): string | null {
  const tenant = impersonationTenant ?? identity.vpbx_user_uid;
  if (!Number.isSafeInteger(identity.uniqueid) || (identity.uniqueid ?? 0) <= 0 || !Number.isSafeInteger(tenant) || (tenant ?? 0) <= 0) return null;
  return PREFIX + tenant + '.' + identity.uniqueid + (impersonationTenant === undefined ? '.user' : '.impersonated');
}

export function loadNavigationHistory(key: string | null): NavigationHistory {
  if (!key) return {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1 || !('visits' in parsed)) return {};
    const visits = parsed.visits;
    if (!visits || typeof visits !== 'object' || Array.isArray(visits)) return {};
    return Object.fromEntries(Object.entries(visits).filter(([, visit]) => visit && typeof visit === 'object'
      && typeof visit.id === 'string' && typeof visit.path === 'string'
      && visit.path.startsWith('/') && !visit.path.startsWith('//') && !/[?#\\]/.test(visit.path)));
  } catch { return {}; }
}

export function saveNavigationHistory(key: string | null, visits: NavigationHistory): void {
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify({ version: 1, visits })); } catch { /* Memory-only when storage is unavailable. */ }
}

export function resolveModuleDestination(row: HubModuleRow, level: UserLevel | undefined, history: NavigationHistory = {}): string {
  if (row.kind === 'off' || row.tenantVisible === false) return '/modules';
  if (row.licenseStatus !== 'active') return moduleHubPath(row.code);
  const pages = filterPagesByLevel(row.pages, level);
  const visit = history[row.code];
  const recent = visit && pages.find((page) => page.id === visit.id && page.path === visit.path);
  return recent?.path ?? pages[0]?.path ?? '/modules';
}
