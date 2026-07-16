/**
 * Display prices for Hub market modules (RUB/month).
 * Must stay aligned with backend LEGACY_HUB_LICENSE_CODES → modules_registry.price_monthly.
 * Server remains authoritative at purchase time.
 */
export const HUB_MARKET_DISPLAY_PRICES: Record<string, number> = {
  callcenter: 1500,
  analytics: 3000,
  ai: 2500,
};

export function resolveHubDisplayPrice(moduleCode: string, fallback = 0): number {
  return HUB_MARKET_DISPLAY_PRICES[moduleCode] ?? fallback;
}
