/** localStorage key for Hub favorites (RESEARCH A4 - per-user prefs). */
export const HUB_FAVORITES_KEY = 'krasterisk.hub.favorites';

export function loadFavoriteCodes(): string[] {
  try {
    const raw = localStorage.getItem(HUB_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

export function saveFavoriteCodes(codes: string[]): void {
  localStorage.setItem(HUB_FAVORITES_KEY, JSON.stringify(codes));
}

export function toggleFavoriteCode(code: string, current: string[]): string[] {
  const next = current.includes(code)
    ? current.filter((c) => c !== code)
    : [...current, code];
  saveFavoriteCodes(next);
  return next;
}

/** Favorites first; preserve relative order within each group. */
export function sortByFavorites<T extends { code: string }>(
  items: T[],
  favoriteCodes: string[],
): T[] {
  const favSet = new Set(favoriteCodes);
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const af = favSet.has(a.item.code) ? 0 : 1;
      const bf = favSet.has(b.item.code) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}
