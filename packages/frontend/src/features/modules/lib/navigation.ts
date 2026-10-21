import type { ModuleDef, ModulePageDef } from '../types';

export function pageMatchesPath(pathname: string, path: string): boolean {
  return pathname === path || (path !== '/' && pathname.startsWith(path + '/'));
}

function matchLength(pathname: string, page: ModulePageDef): number {
  if (pageMatchesPath(pathname, page.path)) return page.path.length;
  const extra = (page.matchPaths ?? []).filter((path) => pageMatchesPath(pathname, path));
  return extra.reduce((best, path) => Math.max(best, path.length), 0);
}

/** One most-specific current page, independent of catalog ordering. */
export function findPageByPath(pathname: string, pages: ModulePageDef[]): ModulePageDef | undefined {
  return pages.reduce<ModulePageDef | undefined>((best, page) => {
    const length = matchLength(pathname, page);
    return length > 0 && (!best || length > matchLength(pathname, best)) ? page : best;
  }, undefined);
}

export function resolveNavigation<T extends ModuleDef>(pathname: string, modules: T[]) {
  if (pageMatchesPath(pathname, '/modules')) return undefined;
  let result: { module: T; page: ModulePageDef } | undefined;
  for (const module of modules) {
    const page = findPageByPath(pathname, module.pages);
    if (page && (!result || page.path.length > result.page.path.length)) result = { module, page };
  }
  return result;
}

export function moduleHubPath(code: string): string {
  return '/modules?module=' + encodeURIComponent(code);
}
