import {
  HUB_MODULES_SEED,
  HUB_MODULE_PAGES_SEED,
  HUB_TABLES,
} from './hub-modules.seed';

/**
 * Wave 1 NAV-05 — Hub catalog seed + table contract (plan 08-02 Task 1).
 */
describe('Hub modules Phase 8 seed', () => {
  it('defines hub_modules and hub_module_pages table names', () => {
    expect(HUB_TABLES).toEqual(
      expect.arrayContaining(['hub_modules', 'hub_module_pages']),
    );
  });

  it('seeds baseline hub codes (core, apps, system, callcenter, analytics, ai)', () => {
    const codes = HUB_MODULES_SEED.map((m) => m.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'core',
        'apps',
        'system',
        'callcenter',
        'analytics',
        'ai',
      ]),
    );
  });

  it('includes Overview tile metadata', () => {
    expect(HUB_MODULES_SEED.some((m) => m.code === 'overview')).toBe(true);
  });

  it('marks Core/Apps/System as base and Call Center/Analytics/AI as market', () => {
    const byCode = Object.fromEntries(HUB_MODULES_SEED.map((m) => [m.code, m]));
    expect(byCode.core.kind).toBe('base');
    expect(byCode.apps.kind).toBe('base');
    expect(byCode.system.kind).toBe('base');
    expect(byCode.callcenter.kind).toBe('market');
    expect(byCode.analytics.kind).toBe('market');
    expect(byCode.ai.kind).toBe('market');
  });

  it('maps queues→apps and service-requests→callcenter (D-15/D-19)', () => {
    const appsPages = HUB_MODULE_PAGES_SEED.filter((p) => p.hub_code === 'apps');
    const ccPages = HUB_MODULE_PAGES_SEED.filter((p) => p.hub_code === 'callcenter');
    expect(appsPages.some((p) => p.page_code === 'queues')).toBe(true);
    expect(ccPages.some((p) => p.page_code === 'service_requests')).toBe(true);
    expect(ccPages.some((p) => p.page_code === 'komandor_claims')).toBe(true);
  });

  it('membership rows reference only seeded hub codes', () => {
    const hubCodes = new Set(HUB_MODULES_SEED.map((m) => m.code));
    for (const page of HUB_MODULE_PAGES_SEED) {
      expect(hubCodes.has(page.hub_code)).toBe(true);
    }
  });
});
