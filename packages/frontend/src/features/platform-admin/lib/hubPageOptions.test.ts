import { describe, it, expect } from 'vitest';
import { HUB_PAGE_OPTIONS, pathForPageCode } from './hubPageOptions';

describe('hubPageOptions', () => {
  it('includes System modules page code for membership', () => {
    expect(HUB_PAGE_OPTIONS.some((o) => o.value === 'tenant_modules')).toBe(true);
    expect(pathForPageCode('tenant_modules')).toBe('/system/modules');
    expect(pathForPageCode('endpoints')).toBe('/endpoints');
  });
});
