import { describe, expect, it } from 'vitest';
import { findPageByPath, pageMatchesPath, resolveNavigation } from './navigation';
import { BASELINE_MODULES, mergeModulesWithCatalog } from './moduleRegistry';

describe('canonical current navigation', () => {
  it.each(['/settings/stt-engines', '/reports/cdr', '/autodial/bases'])('selects the deepest page for %s', (path) => {
    const current = resolveNavigation(path, BASELINE_MODULES);
    expect(current?.page.path).toBe(path);
    expect(findPageByPath(path + '/42', current!.module.pages)?.id).toBe(current!.page.id);
  });
  it('respects segment boundaries, root and Hub', () => {
    expect(pageMatchesPath('/settings-other', '/settings')).toBe(false);
    expect(pageMatchesPath('/settings', '/')).toBe(false);
    expect(resolveNavigation('/modules', BASELINE_MODULES)).toBeUndefined();
    expect(resolveNavigation('/profile', BASELINE_MODULES)).toBeUndefined();
  });
  it('uses catalog page ownership instead of baseline ownership', () => {
    const rows = mergeModulesWithCatalog(BASELINE_MODULES, [{ code: 'core', licenseStatus: 'active', pages: [{ page_code: 'queues', path: '/queues' }] }]);
    expect(resolveNavigation('/queues', rows)?.module.code).toBe('core');
  });
});
