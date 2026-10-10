import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Phone } from 'lucide-react';
import { UserLevel } from '@krasterisk/shared';
import type { HubModuleRow } from '../types';
import { loadNavigationHistory, navigationStorageKey, resolveModuleDestination, saveNavigationHistory } from './navigationHistory';
const row: HubModuleRow = { code: 'core', kind: 'base', navVariant: 'sidebar', labelKey: 'nav.pbx', licenseStatus: 'active', favorite: false,
  pages: [{ id: 'endpoints', path: '/endpoints', labelKey: 'endpoints.title', icon: Phone }, { id: 'trunks', path: '/trunks', labelKey: 'nav.trunks', icon: Phone, minLevels: [UserLevel.ADMIN] }] };
const history = { core: { id: 'trunks', path: '/trunks' } };
describe('scoped navigation history', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
  it('separates users, tenants and impersonation and rejects incomplete identity', () => {
    const key = navigationStorageKey({ uniqueid: 1, vpbx_user_uid: 7 });
    expect(key).not.toBe(navigationStorageKey({ uniqueid: 2, vpbx_user_uid: 7 }));
    expect(key).not.toBe(navigationStorageKey({ uniqueid: 1, vpbx_user_uid: 8 }));
    expect(key).not.toBe(navigationStorageKey({ uniqueid: 1, vpbx_user_uid: 7 }, 7));
    expect(navigationStorageKey({ uniqueid: 1 })).toBeNull();
  });
  it('restores only a currently permitted canonical page owned by this module', () => {
    expect(resolveModuleDestination(row, UserLevel.ADMIN, history)).toBe('/trunks');
    expect(resolveModuleDestination(row, UserLevel.OPERATOR, history)).toBe('/endpoints');
    expect(resolveModuleDestination({ ...row, pages: [row.pages[0]] }, UserLevel.ADMIN, history)).toBe('/endpoints');
    expect(resolveModuleDestination(row, UserLevel.ADMIN, { core: { id: 'trunks', path: '/trunks/42?draft=x' } })).toBe('/endpoints');
    expect(resolveModuleDestination({ ...row, pages: [] }, UserLevel.ADMIN, history)).toBe('/modules');
    expect(resolveModuleDestination({ ...row, tenantVisible: false }, UserLevel.ADMIN, history)).toBe('/modules');
    expect(resolveModuleDestination({ ...row, kind: 'off' }, UserLevel.ADMIN, history)).toBe('/modules');
  });
  it.each(['locked', 'disabled'] as const)('never restores a %s module', (licenseStatus) => {
    expect(resolveModuleDestination({ ...row, licenseStatus }, UserLevel.ADMIN, history)).toBe('/modules?module=core');
  });
  it('rejects malformed and unsafe storage and survives storage exceptions', () => {
    const key='test-history';localStorage.setItem(key,'oops');expect(loadNavigationHistory(key)).toEqual({});
    for (const path of ['https://example.com','//example.com','/trunks?query=x','/trunks#draft']) {
      localStorage.setItem(key,JSON.stringify({version:1,visits:{core:{id:'trunks',path}}}));expect(loadNavigationHistory(key)).toEqual({});
    }
    saveNavigationHistory(key,history);expect(loadNavigationHistory(key)).toEqual(history);
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('denied');});
    expect(()=>saveNavigationHistory(key,history)).not.toThrow();
  });
});
