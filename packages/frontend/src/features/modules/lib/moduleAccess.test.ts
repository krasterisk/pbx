import { describe, expect, it } from 'vitest';
import { UserLevel } from '@krasterisk/shared';
import { accessExpiryDate, resolveModuleAccess, type AccessModule } from './moduleAccess';

const active: AccessModule = { licenseStatus: 'active', kind: 'market', accessUntil: '2026-10-20T00:00:00.000Z' };

describe('resolveModuleAccess', () => {
  it.each(['loading', 'error'] as const)('does not decide while the catalog is %s', (catalogState) => {
    expect(resolveModuleAccess(active, true, { level: UserLevel.ADMIN, catalogState }).state).toBe('loading');
  });

  it('hides modules the cabinet does not have', () => {
    expect(resolveModuleAccess(undefined, false, { catalogState: 'ready' }).state).toBe('hidden');
    expect(resolveModuleAccess({ ...active, kind: 'off' }, true, { catalogState: 'ready' }).state).toBe('hidden');
    expect(resolveModuleAccess({ ...active, tenantVisible: false }, true, { catalogState: 'ready' }).state).toBe('hidden');
  });

  it('lets only a tenant admin buy or enable', () => {
    const locked = { ...active, licenseStatus: 'locked' as const };
    const disabled = { ...active, licenseStatus: 'disabled' as const };
    expect(resolveModuleAccess(locked, false, { level: UserLevel.ADMIN, catalogState: 'ready' })).toEqual({ state: 'locked', canBuy: true });
    expect(resolveModuleAccess(locked, false, { level: UserLevel.OPERATOR, catalogState: 'ready' })).toEqual({ state: 'locked', canBuy: false });
    expect(resolveModuleAccess(locked, false, { level: UserLevel.SUPERADMIN, catalogState: 'ready' })).toEqual({ state: 'locked', canBuy: false });
    expect(resolveModuleAccess(disabled, false, { level: UserLevel.ADMIN, catalogState: 'ready' })).toEqual({ state: 'disabled', canEnable: true });
    expect(resolveModuleAccess(disabled, false, { level: UserLevel.SUPERVISOR, catalogState: 'ready' })).toEqual({ state: 'disabled', canEnable: false });
  });

  it('forbids an active page the role cannot open', () => {
    expect(resolveModuleAccess(active, false, { level: UserLevel.OPERATOR, catalogState: 'ready' }).state).toBe('forbidden');
    expect(resolveModuleAccess(active, true, { level: UserLevel.OPERATOR, catalogState: 'ready' }).state).toBe('ok');
  });
});

describe('accessExpiryDate', () => {
  const now = new Date('2026-10-17T12:00:00.000Z');

  it('formats a date inside the next 7 days', () => {
    expect(accessExpiryDate('2026-10-20T00:00:00.000Z', now)).toMatch(/^\d{2}\.\d{2}$/);
  });

  it('ignores dates further away, in the past, or empty', () => {
    expect(accessExpiryDate('2026-12-01T00:00:00.000Z', now)).toBeNull();
    expect(accessExpiryDate('2026-10-01T00:00:00.000Z', now)).toBeNull();
    expect(accessExpiryDate(null, now)).toBeNull();
    expect(accessExpiryDate('not-a-date', now)).toBeNull();
  });
});
