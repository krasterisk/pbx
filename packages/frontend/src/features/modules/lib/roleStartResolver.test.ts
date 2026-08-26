import { describe, it, expect } from 'vitest';
import { UserLevel } from '@krasterisk/shared';
import { resolveRoleStart } from './roleStartResolver';

describe('resolveRoleStart (NAV-05 / D-16)', () => {
  it('returns OPERATOR → Call Center agent', () => {
    expect(resolveRoleStart(UserLevel.OPERATOR)).toBe('/callcenter/agent');
  });

  it('returns SUPERVISOR → Call Center supervisor', () => {
    expect(resolveRoleStart(UserLevel.SUPERVISOR)).toBe('/callcenter/supervisor');
  });

  it('returns ADMIN → Overview', () => {
    expect(resolveRoleStart(UserLevel.ADMIN)).toBe('/');
  });

  it('falls back to Overview when Call Center is off (D-16 CC-off)', () => {
    expect(
      resolveRoleStart(UserLevel.OPERATOR, { callCenterEnabled: false }),
    ).toBe('/');
    expect(
      resolveRoleStart(UserLevel.SUPERVISOR, { callCenterEnabled: false }),
    ).toBe('/');
    // ADMIN already Overview - unchanged
    expect(resolveRoleStart(UserLevel.ADMIN, { callCenterEnabled: false })).toBe('/');
  });

  it('locked deep-link returns role-default fallback path, not the locked target (D-17)', () => {
    expect(
      resolveRoleStart(UserLevel.OPERATOR, {
        lockedDeepLink: '/callcenter/reports',
      }),
    ).toBe('/callcenter/agent');

    expect(
      resolveRoleStart(UserLevel.OPERATOR, {
        callCenterEnabled: false,
        lockedDeepLink: '/analytics/advanced',
      }),
    ).toBe('/');

    expect(
      resolveRoleStart(UserLevel.ADMIN, {
        lockedDeepLink: '/ai-agents',
      }),
    ).toBe('/');
  });

  it('prefers apiPath from GET /marketplace/role-start when provided', () => {
    expect(
      resolveRoleStart(UserLevel.OPERATOR, { apiPath: '/queues' }),
    ).toBe('/queues');
  });

  it('falls back to local D-16 defaults when apiPath absent (offline)', () => {
    expect(resolveRoleStart(UserLevel.OPERATOR)).toBe('/callcenter/agent');
  });

  it('prefers tenant override over platform default and local D-16 (D-04)', () => {
    expect(
      resolveRoleStart(UserLevel.OPERATOR, {
        tenantOverride: '/queues',
        platformDefault: '/callcenter/supervisor',
      }),
    ).toBe('/queues');

    expect(
      resolveRoleStart(UserLevel.OPERATOR, {
        platformDefault: '/reports',
      }),
    ).toBe('/reports');
  });

  it('apiPath wins over explicit tenant/platform inputs (server resolved)', () => {
    expect(
      resolveRoleStart(UserLevel.OPERATOR, {
        apiPath: '/moh',
        tenantOverride: '/queues',
        platformDefault: '/',
      }),
    ).toBe('/moh');
  });
});

