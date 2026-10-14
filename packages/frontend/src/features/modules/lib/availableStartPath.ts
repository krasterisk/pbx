import type { UserLevel } from '@krasterisk/shared';
import type { HubModuleRow } from '../types';
import { filterPagesByLevel, findModuleByPath, isHubModuleShown } from './moduleRegistry';

/** Keep eligible configured starts; never use a hidden/empty/unlicensed module as fallback. */
export function resolveAvailableStartPath(preferredPath: string, rows: HubModuleRow[], level: UserLevel | undefined): string {
  const pathname = preferredPath.split(/[?#]/)[0];
  const available = rows.filter((row) => isHubModuleShown(row) && row.licenseStatus === 'active')
    .map((row) => ({ ...row, pages: filterPagesByLevel(row.pages, level) }))
    .filter((row) => row.pages.length > 0);
  // This public product landing intentionally displays its own locked/expired state.
  if (pathname === '/ai-robots') return preferredPath;
  if (findModuleByPath(pathname, available)) return preferredPath;
  // Service/custom routes are not catalog pages and retain their explicit destination.
  if (pathname !== '/' && !findModuleByPath(pathname)) return preferredPath;
  return available[0]?.pages[0]?.path ?? '/modules';
}
