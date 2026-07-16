import type { PaletteItem } from './filterPaletteItems';

export type PaletteModuleSource = {
  code: string;
  label: string;
  entryPath: string;
};

export type PalettePageSource = {
  id: string;
  label: string;
  path: string;
};

/**
 * Build ⌘K items: licensed Hub modules + current-module pages (path-deduped).
 * Module entry wins when a page shares the same path.
 */
export function buildPaletteItems(
  modules: PaletteModuleSource[],
  pages: PalettePageSource[],
): PaletteItem[] {
  const byPath = new Map<string, PaletteItem>();

  for (const mod of modules) {
    byPath.set(mod.entryPath, {
      id: `module:${mod.code}`,
      label: mod.label,
      path: mod.entryPath,
    });
  }

  for (const page of pages) {
    if (byPath.has(page.path)) continue;
    byPath.set(page.path, {
      id: `page:${page.id}`,
      label: page.label,
      path: page.path,
    });
  }

  return Array.from(byPath.values());
}
