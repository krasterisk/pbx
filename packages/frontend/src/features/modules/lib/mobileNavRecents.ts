import type { UserLevel } from '@krasterisk/shared';
import { filterPagesByLevel } from './moduleRegistry';
import type { HubModuleRow, ModulePageDef } from '../types';

export const MOBILE_NAV_STORAGE_KEY = 'krasterisk.mobileNav.recents';
export const HUB_CODE = 'hub';
export const MAX_RECENTS = 12;
export const NEIGHBOR_COUNT = 3;

export interface MobileNavState {
  codes: string[];
  lastPathByCode: Record<string, string>;
}

export interface MobileBarLayout {
  left: string;
  center: string;
  right: string;
  farRight: string;
}

const EMPTY_STATE: MobileNavState = { codes: [], lastPathByCode: {} };

export function isHubPath(pathname: string): boolean {
  return pathname === '/modules' || pathname.startsWith('/modules/');
}

export function resolveCenterCode(
  pathname: string,
  moduleCode: string | undefined,
): string {
  if (isHubPath(pathname) || !moduleCode || moduleCode === 'overview') {
    return HUB_CODE;
  }
  return moduleCode;
}

export function readMobileNavState(): MobileNavState {
  try {
    const raw = localStorage.getItem(MOBILE_NAV_STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<MobileNavState>;
    const codes = Array.isArray(parsed.codes)
      ? parsed.codes.filter((c): c is string => typeof c === 'string')
      : [];
    const lastPathByCode =
      parsed.lastPathByCode && typeof parsed.lastPathByCode === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.lastPathByCode).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string',
            ),
          )
        : {};
    return { codes, lastPathByCode };
  } catch {
    return EMPTY_STATE;
  }
}

export function writeMobileNavState(state: MobileNavState): void {
  try {
    localStorage.setItem(MOBILE_NAV_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

export function rememberVisit(
  state: MobileNavState,
  code: string,
  path: string,
): MobileNavState {
  return {
    codes: [code, ...state.codes.filter((item) => item !== code)].slice(0, MAX_RECENTS),
    lastPathByCode: { ...state.lastPathByCode, [code]: path },
  };
}

export function buildFallbackCodes(activeModules: HubModuleRow[]): string[] {
  return [HUB_CODE, ...activeModules.map((row) => row.code)];
}

export function buildNeighborCodes(
  center: string,
  recents: string[],
  fallback: string[],
): [string, string, string] {
  const seen = new Set<string>([center]);
  const ordered: string[] = [];
  for (const code of [...recents, ...fallback]) {
    if (!code || seen.has(code)) continue;
    seen.add(code);
    ordered.push(code);
    if (ordered.length === NEIGHBOR_COUNT) break;
  }
  while (ordered.length < NEIGHBOR_COUNT) ordered.push('');
  return [ordered[0], ordered[1], ordered[2]];
}

/** Picker | older | current | most-recent-other | next — current stays visually centered. */
export function buildMobileBarLayout(
  center: string,
  recents: string[],
  fallback: string[],
): MobileBarLayout {
  const [mostRecent, older, next] = buildNeighborCodes(center, recents, fallback);
  return {
    left: older,
    center,
    right: mostRecent,
    farRight: next,
  };
}

export function resolveRecentPath(
  code: string,
  lastPath: string | undefined,
  row: HubModuleRow | undefined,
  level: UserLevel | undefined,
): string {
  if (code === HUB_CODE) return '/modules';
  if (!row || row.licenseStatus !== 'active') return '/modules';
  const pages = filterPagesByLevel(row.pages, level);
  if (
    lastPath &&
    pages.some(
      (page) =>
        lastPath === page.path ||
        (page.path !== '/' && lastPath.startsWith(`${page.path}/`)),
    )
  ) {
    return lastPath;
  }
  return pages[0]?.path ?? '/modules';
}

export function pageMatchesQuery(
  page: ModulePageDef,
  query: string,
  translate: (key: string) => string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return translate(page.labelKey).toLowerCase().includes(q) || page.path.toLowerCase().includes(q);
}

export function moduleMatchesQuery(
  row: HubModuleRow,
  query: string,
  translate: (key: string) => string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = translate(row.labelKey).toLowerCase();
  return name.includes(q) || row.code.toLowerCase().includes(q);
}
