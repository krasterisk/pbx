import type { UserLevel } from '@krasterisk/shared';
import { normalizeLoginReturnPath } from '@/shared/lib/auth/loginReturn';
import type { HubModuleRow } from '../types';
import { BASELINE_MODULES, findModuleByPath, isHubModuleShown } from './moduleRegistry';
import { findPageByPath } from './navigation';

/** Resolve the most specific page BEFORE role filtering; a parent must not admit a forbidden child. */
export function resolveLoginReturnPath(path: string | null, rows: HubModuleRow[], level: UserLevel): string | null {
  const local = normalizeLoginReturnPath(path);
  if (!local) return null;
  const pathname = local.split(/[?#]/)[0];
  if (pathname === '/modules' || pathname === '/profile') return local;
  const baseline = findModuleByPath(pathname, BASELINE_MODULES);
  const page = baseline && findPageByPath(pathname, baseline.pages);
  if (!baseline || !page) return null;
  const row = rows.find((item) => item.code === baseline.code);
  if (!row || !isHubModuleShown(row) || row.licenseStatus !== 'active') return null;
  const availablePage = row.pages.find((item) => item.id === page.id);
  if (!availablePage) return null;
  if ([page, availablePage].some((item) => (item.minLevels && !item.minLevels.includes(level))
    || (item.routeAllow && !item.routeAllow.includes(level)))) return null;
  return local;
}
