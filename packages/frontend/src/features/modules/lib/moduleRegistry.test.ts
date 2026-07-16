import { describe, it, expect } from 'vitest';
import { UserLevel } from '@krasterisk/shared';
import {
  BASELINE_MODULES,
  filterModulesForLevel,
  filterPagesByLevel,
  getBaselineModule,
  partitionModulesByLicense,
} from './moduleRegistry';
import { mapTenantStatusToLicenseStatus } from './licenseStatus';

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
