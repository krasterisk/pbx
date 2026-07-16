import { describe, it, expect, beforeEach } from 'vitest';
import { UserLevel } from '@krasterisk/shared';
import {
  BASELINE_MODULES,
  buildHubSections,
  filterModulesForLevel,
  filterPagesByLevel,
  findModuleByPath,
  getBaselineModule,
  mergeModulesWithCatalog,
  partitionModulesByLicense,
} from './moduleRegistry';
import { mapTenantStatusToLicenseStatus } from './licenseStatus';
import {
  HUB_FAVORITES_KEY,
  loadFavoriteCodes,
  sortByFavorites,
  toggleFavoriteCode,
} from './favorites';

describe('moduleRegistry (NAV-01)', () => {
  it('BASELINE_MODULES includes required Hub codes', () => {
    const codes = BASELINE_MODULES.map((m) => m.code);
    expect(codes).toEqual(
      expect.arrayContaining(['core', 'apps', 'system', 'callcenter', 'analytics', 'ai']),
    );
  });

  it('maps Hub modules to expected page paths', () => {
    const core = getBaselineModule('core');
    expect(core?.pages.map((p) => p.path)).toEqual(
      expect.arrayContaining(['/endpoints', '/trunks', '/routes', '/phonebooks']),
    );

    const apps = getBaselineModule('apps');
    expect(apps?.pages.map((p) => p.path)).toEqual(
      expect.arrayContaining(['/ivrs', '/queues', '/moh', '/call-groups', '/integrations']),
    );

    const callcenter = getBaselineModule('callcenter');
    expect(callcenter?.kind).toBe('market');
    expect(callcenter?.pages.map((p) => p.path)).toEqual(
      expect.arrayContaining([
        '/service-requests',
        '/callcenter/agent',
        '/callcenter/supervisor',
        '/callcenter/reports',
        '/callcenter/settings',
      ]),
    );
    // Wallboard TV stays outside ModuleShell
    expect(callcenter?.pages.some((p) => p.path === '/callcenter/wallboard')).toBe(false);
  });

  it('filters pages by UserLevel (CC agent visible to OPERATOR, settings only ADMIN+)', () => {
    const cc = getBaselineModule('callcenter')!;
    const operatorPages = filterPagesByLevel(cc.pages, UserLevel.OPERATOR).map((p) => p.id);
    expect(operatorPages).toContain('cc-agent');
    expect(operatorPages).not.toContain('cc-supervisor');
    expect(operatorPages).not.toContain('cc-settings');

    const adminPages = filterPagesByLevel(cc.pages, UserLevel.ADMIN).map((p) => p.id);
    expect(adminPages).toEqual(
      expect.arrayContaining(['cc-agent', 'cc-supervisor', 'cc-settings']),
    );
  });

  it('filterModulesForLevel drops modules with no visible pages', () => {
    const forOperator = filterModulesForLevel(BASELINE_MODULES, UserLevel.OPERATOR);
    const system = forOperator.find((m) => m.code === 'system');
    // System pages are ADMIN+ — operator should not see system module
    expect(system).toBeUndefined();
    expect(forOperator.some((m) => m.code === 'callcenter')).toBe(true);
  });

  it('partitionModulesByLicense splits active / disabled / locked', () => {
    const { active, disabled, locked } = partitionModulesByLicense(BASELINE_MODULES, {
      callcenter: 'disabled',
      analytics: 'locked',
      ai: 'active',
    });
    expect(active.some((m) => m.code === 'ai')).toBe(true);
    expect(active.some((m) => m.code === 'core')).toBe(true); // base default active
    expect(disabled.map((m) => m.code)).toContain('callcenter');
    expect(locked.map((m) => m.code)).toContain('analytics');
  });
});

describe('mapTenantStatusToLicenseStatus', () => {
  it('maps active → active, inactive/off → disabled, missing → locked', () => {
    expect(mapTenantStatusToLicenseStatus('active')).toBe('active');
    expect(mapTenantStatusToLicenseStatus('inactive')).toBe('disabled');
    expect(mapTenantStatusToLicenseStatus('off')).toBe('disabled');
    expect(mapTenantStatusToLicenseStatus(null)).toBe('locked');
    expect(mapTenantStatusToLicenseStatus(undefined)).toBe('locked');
    expect(mapTenantStatusToLicenseStatus('missing')).toBe('locked');
  });
});

describe('hub merge + favorites (NAV-02)', () => {
  beforeEach(() => {
    localStorage.removeItem(HUB_FAVORITES_KEY);
  });

  it('mergeModulesWithCatalog applies server licenseStatus (never invents active for market)', () => {
    const rows = mergeModulesWithCatalog(BASELINE_MODULES, [
      { code: 'callcenter', licenseStatus: 'disabled', name: 'Call Center' },
      { code: 'analytics', licenseStatus: 'locked' },
      { code: 'ai', licenseStatus: 'active' },
    ]);

    expect(rows.find((r) => r.code === 'callcenter')?.licenseStatus).toBe('disabled');
    expect(rows.find((r) => r.code === 'analytics')?.licenseStatus).toBe('locked');
    expect(rows.find((r) => r.code === 'ai')?.licenseStatus).toBe('active');
    expect(rows.find((r) => r.code === 'core')?.licenseStatus).toBe('active'); // base default
  });

  it('buildHubSections puts active+disabled in Active and locked in Marketplace', () => {
    const rows = mergeModulesWithCatalog(BASELINE_MODULES, [
      { code: 'callcenter', licenseStatus: 'disabled' },
      { code: 'analytics', licenseStatus: 'locked' },
      { code: 'ai', licenseStatus: 'locked' },
    ]);
    const { active, marketplace } = buildHubSections(rows, []);

    expect(active.some((r) => r.code === 'callcenter')).toBe(true);
    expect(active.some((r) => r.code === 'core')).toBe(true);
    expect(active.every((r) => r.licenseStatus !== 'locked')).toBe(true);

    expect(marketplace.map((r) => r.code).sort()).toEqual(
      expect.arrayContaining(['analytics', 'ai']),
    );
    expect(marketplace.every((r) => r.licenseStatus === 'locked')).toBe(true);
    // Disabled must never be Buy/Marketplace targets
    expect(marketplace.some((r) => r.code === 'callcenter')).toBe(false);
  });

  it('favorites sort to top of Active section', () => {
    const rows = mergeModulesWithCatalog(BASELINE_MODULES, [
      { code: 'ai', licenseStatus: 'active' },
      { code: 'callcenter', licenseStatus: 'active' },
    ]);
    const { active } = buildHubSections(rows, ['ai']);
    const activeCodes = active.map((r) => r.code);
    expect(activeCodes[0]).toBe('ai');
    expect(active.find((r) => r.code === 'ai')?.favorite).toBe(true);
  });

  it('sortByFavorites preserves relative order of non-favorites', () => {
    const items = [{ code: 'a' }, { code: 'b' }, { code: 'c' }];
    expect(sortByFavorites(items, ['c']).map((i) => i.code)).toEqual(['c', 'a', 'b']);
  });

  it('toggleFavoriteCode persists to localStorage', () => {
    const next = toggleFavoriteCode('apps', []);
    expect(next).toEqual(['apps']);
    expect(loadFavoriteCodes()).toEqual(['apps']);
    expect(toggleFavoriteCode('apps', next)).toEqual([]);
  });

  it('findModuleByPath resolves longest match and ignores Hub route', () => {
    expect(findModuleByPath('/modules')).toBeUndefined();
    expect(findModuleByPath('/endpoints')?.code).toBe('core');
    expect(findModuleByPath('/callcenter/agent')?.code).toBe('callcenter');
    expect(findModuleByPath('/')?.code).toBe('overview');
  });
});
