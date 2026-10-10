export type PaletteItem = {
  id: string;
  label: string;
  path: string;
  section?: string;
  keywords?: string[];
};

export function filterPaletteItems(query: string, items: PaletteItem[]): PaletteItem[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return items;
  return items.filter((item) => [item.label, item.path, item.section ?? '', ...(item.keywords ?? [])]
    .some((value) => value.toLocaleLowerCase().includes(q)));
}
