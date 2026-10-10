import type { PaletteItem } from './filterPaletteItems';

export type PaletteModuleSource = { code: string; label: string; entryPath: string };
export type PalettePageSource = { id: string; label: string; path: string; section?: string };

/** One URL, preserving both the section and page names for searching. */
export function buildPaletteItems(modules: PaletteModuleSource[], pages: PalettePageSource[]): PaletteItem[] {
  const byPath = new Map<string, PaletteItem>();
  for (const mod of modules) {
    byPath.set(mod.entryPath, { id: 'module:' + mod.code, label: mod.label, path: mod.entryPath, keywords: [mod.label] });
  }
  for (const page of pages) {
    const previous = byPath.get(page.path);
    if (previous) {
      byPath.set(page.path, { ...previous, label: page.section ? page.label : previous.label, section: page.section,
        keywords: [...(previous.keywords ?? []), page.label, ...(page.section ? [page.section] : [])] });
    } else {
      byPath.set(page.path, { id: 'page:' + page.id, label: page.label, path: page.path, section: page.section });
    }
  }
  return Array.from(byPath.values());
}
