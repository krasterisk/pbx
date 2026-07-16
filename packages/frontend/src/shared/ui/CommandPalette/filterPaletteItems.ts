export type PaletteItem = {
  id: string;
  label: string;
  path: string;
};

/**
 * Pure ⌘K filter helper (NAV-04 / D-06). Dialog shell lands in plan 08-04.
 */
export function filterPaletteItems(
  query: string,
  items: PaletteItem[],
): PaletteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.path.toLowerCase().includes(q),
  );
}
