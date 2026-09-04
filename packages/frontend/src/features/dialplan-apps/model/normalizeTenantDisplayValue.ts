import { extractExtension, interfaceToExtension } from '@/features/endpoints/lib/endpointIds';

/** Store / display bare extension — strip PJSIP/e101_42 or ew101_42 pasted by mistake. */
export function normalizeBareExtension(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.includes('/')) return interfaceToExtension(trimmed);
  if (/^e(w?).+_\d+$/.test(trimmed)) return extractExtension(trimmed);
  return trimmed;
}

/** q700_0 → 700; sales_7 stays sales_7 (no leading q). */
export function stripTenantQueueName(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^q(.+)_\d+$/i);
  return match?.[1] ?? trimmed;
}

/**
 * Display-only: hide tenant suffixes on queue / endpoint realtime ids.
 * Does not rewrite stored params — dialplan apply still accepts q700_0 / e101_0.
 */
export function normalizeTenantDisplayValue(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return trimmed;
  const asQueue = stripTenantQueueName(trimmed);
  if (asQueue !== trimmed) return asQueue;
  const asExten = normalizeBareExtension(trimmed);
  return asExten || trimmed;
}

/** Prefer the catalog value when stored data still has a tenant-suffixed id. */
export function matchCatalogValue(
  stored: string,
  items: ReadonlyArray<{ value: string }>,
): string {
  if (!stored) return stored;
  if (items.some((item) => item.value === stored)) return stored;
  const normalized = normalizeTenantDisplayValue(stored);
  if (normalized !== stored && items.some((item) => item.value === normalized)) {
    return normalized;
  }
  return stored;
}
