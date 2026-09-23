import { describe, it, expect } from 'vitest';
import { resolveHubDisplayPrice } from './hubMarketPrices';

describe('resolveHubDisplayPrice', () => {
  it('uses the catalog displayPrice and falls back to 0', () => {
    expect(resolveHubDisplayPrice({ displayPrice: 1500 })).toBe(1500);
    expect(resolveHubDisplayPrice({ displayPrice: undefined })).toBe(0);
    expect(resolveHubDisplayPrice(null)).toBe(0);
    expect(resolveHubDisplayPrice(2500)).toBe(2500);
  });
});
