/**
 * Hub display price comes from the hub-catalog API (`displayPrice`).
 * Fallback is 0 — the server remains authoritative at purchase time.
 */
export function resolveHubDisplayPrice(
  item: { displayPrice?: number | null } | number | null | undefined,
  fallback = 0,
): number {
  if (typeof item === 'number' && Number.isFinite(item)) return item;
  if (item && typeof item === 'object' && typeof item.displayPrice === 'number' && Number.isFinite(item.displayPrice)) {
    return item.displayPrice;
  }
  return fallback;
}
