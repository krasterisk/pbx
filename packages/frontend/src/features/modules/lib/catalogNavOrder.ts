import { HUB_PAGE_OPTIONS } from '@/features/platform-admin/lib/hubPageOptions';
import type { ModuleDef, ModulePageDef } from '../types';

export interface CatalogPageOrder {
  page_code: string;
  path?: string | null;
  sort_order?: number;
}

export interface CatalogModuleOrder {
  code: string;
  sort_order?: number;
  pages?: CatalogPageOrder[];
}

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

function codeAliases(code: string): string[] {
  return [...new Set([code, code.replace(/_/g, '-'), code.replace(/-/g, '_')])];
}

const managedCodes = new Set(HUB_PAGE_OPTIONS.map((option) => option.value));
const managedPaths = new Set(
  HUB_PAGE_OPTIONS.map((option) => {
    const match = /\(([^)]+)\)\s*$/.exec(option.label);
    return match?.[1] ? normalizePath(match[1]) : '';
  }).filter((path) => path.length > 0),
);

/** Pages the platform catalog editor can assign. Anything else stays on its baseline module. */
export function isCatalogManagedPage(page: ModulePageDef): boolean {
  if (managedPaths.has(normalizePath(page.path))) return true;
  return codeAliases(page.id).some((key) => managedCodes.has(key));
}

function indexPages(modules: ModuleDef[]): Map<string, ModulePageDef> {
  const map = new Map<string, ModulePageDef>();
  const put = (key: string, page: ModulePageDef) => {
    if (!map.has(key)) map.set(key, page);
  };
  for (const mod of modules) {
    for (const page of mod.pages) {
      put(`path:${normalizePath(page.path)}`, page);
      for (const alias of codeAliases(page.id)) put(`code:${alias}`, page);
    }
  }
  return map;
}

function resolvePage(
  index: Map<string, ModulePageDef>,
  ref: CatalogPageOrder,
): ModulePageDef | undefined {
  if (ref.path) {
    const byPath = index.get(`path:${normalizePath(ref.path)}`);
    if (byPath) return byPath;
  }
  for (const alias of codeAliases(ref.page_code)) {
    const byCode = index.get(`code:${alias}`);
    if (byCode) return byCode;
  }
  return undefined;
}

/**
 * Navbar membership and order follow the platform catalog.
 * Baseline pages the editor does not know (for example route templates) stay at the end.
 */
export function applyCatalogNav<T extends ModuleDef>(
  modules: T[],
  catalog: CatalogModuleOrder[] | undefined,
): T[] {
  if (!catalog?.some((item) => (item.pages?.length ?? 0) > 0)) return modules;

  const index = indexPages(modules);
  const assignedIds = new Set<string>();
  const pagesByCode = new Map<string, ModulePageDef[]>();

  for (const item of catalog) {
    if (!item.pages?.length) {
      pagesByCode.set(item.code, []);
      continue;
    }
    const sorted = [...item.pages].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const pages: ModulePageDef[] = [];
    const seen = new Set<string>();
    for (const ref of sorted) {
      const page = resolvePage(index, ref);
      if (!page || seen.has(page.id)) continue;
      seen.add(page.id);
      assignedIds.add(page.id);
      pages.push(page);
    }
    pagesByCode.set(item.code, pages);
  }

  return modules.map((mod) => {
    const item = catalog.find((row) => row.code === mod.code);
    if (!item || !Array.isArray(item.pages)) {
      return {
        ...mod,
        pages: mod.pages.filter((page) => !assignedIds.has(page.id)),
      };
    }
    const assigned = pagesByCode.get(mod.code) ?? [];
    const seen = new Set(assigned.map((page) => page.id));
    const extras = mod.pages.filter(
      (page) => !seen.has(page.id) && !assignedIds.has(page.id) && !isCatalogManagedPage(page),
    );
    return { ...mod, pages: [...assigned, ...extras] };
  });
}

/** Platform catalog sort_order. Modules without a catalog position stay at the end. */
export function sortModulesByCatalogOrder<T extends { code: string }>(
  modules: T[],
  catalog: Array<{ code: string; sort_order?: number }> | undefined,
): T[] {
  if (!catalog?.some((item) => item.sort_order != null)) return modules;
  const order = new Map(catalog.map((item) => [item.code, item.sort_order]));
  return [...modules].sort((a, b) => {
    const left = order.get(a.code);
    const right = order.get(b.code);
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return left - right;
  });
}
