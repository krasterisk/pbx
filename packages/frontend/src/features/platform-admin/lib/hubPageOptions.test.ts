import { describe, it, expect } from 'vitest';
import { HUB_PAGE_OPTIONS, pathForPageCode } from './hubPageOptions';

describe('hubPageOptions', () => {
  it('resolves known page paths and no longer offers the removed modules page', () => {
    expect(HUB_PAGE_OPTIONS.some((o) => o.value === 'tenant_modules')).toBe(false);
    expect(pathForPageCode('tenant_modules')).toBeNull();
    expect(pathForPageCode('endpoints')).toBe('/endpoints');
  });
});
