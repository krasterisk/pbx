import type { ModuleDef, ModulePageDef } from '../types';

export function pageMatchesPath(pathname: string, path: string): boolean {
  return pathname === path || (path !== '/' && pathname.startsWith(path + '/'));
}

/** One most-specific current page, independent of catalog ordering. */
export function findPageByPath(pathname: string, pages: ModulePageDef[]): ModulePageDef | undefined {
  return pages.reduce<ModulePageDef | undefined>((best, page) =>
    pageMatchesPath(pathname, page.path) && (!best || page.path.length > best.path.length) ? page : best,
  undefined);
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
