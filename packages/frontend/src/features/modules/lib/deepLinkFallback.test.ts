import { describe, it, expect } from 'vitest';
import { UserLevel } from '@krasterisk/shared';
import {
  MODULE_UNAVAILABLE_MESSAGE_KEY,
  resolveDeepLinkFallback,
} from './deepLinkFallback';

describe('resolveDeepLinkFallback (NAV-05 / D-17)', () => {
  it('returns null for active or unknown license status', () => {
    expect(
      resolveDeepLinkFallback({
        licenseStatus: 'active',
        level: UserLevel.ADMIN,
      }),
    ).toBeNull();

    expect(
      resolveDeepLinkFallback({
        licenseStatus: undefined,
        level: UserLevel.ADMIN,
      }),
    ).toBeNull();
  });

  it('locked module falls back to role-default with unavailable copy key', () => {
    expect(
      resolveDeepLinkFallback({
        licenseStatus: 'locked',
        level: UserLevel.OPERATOR,
      }),
    ).toEqual({
      path: '/callcenter/agent',
      messageKey: MODULE_UNAVAILABLE_MESSAGE_KEY,
    });

    expect(
      resolveDeepLinkFallback({
        licenseStatus: 'locked',
        level: UserLevel.ADMIN,
      }),
    ).toEqual({
      path: '/',
      messageKey: MODULE_UNAVAILABLE_MESSAGE_KEY,
    });
  });

  it('disabled module uses the same smart fallback as locked', () => {
    expect(
      resolveDeepLinkFallback({
        licenseStatus: 'disabled',
        level: UserLevel.SUPERVISOR,
      }),
    ).toEqual({
      path: '/callcenter/supervisor',
      messageKey: MODULE_UNAVAILABLE_MESSAGE_KEY,
    });

    expect(
      resolveDeepLinkFallback({
        licenseStatus: 'disabled',
        level: UserLevel.OPERATOR,
        callCenterEnabled: false,
      }),
    ).toEqual({
      path: '/',
      messageKey: MODULE_UNAVAILABLE_MESSAGE_KEY,
    });
  });
});
