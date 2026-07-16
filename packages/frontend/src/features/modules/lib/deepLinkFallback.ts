import { UserLevel } from '@krasterisk/shared';
import type { LicenseStatus } from '../types';
import { resolveRoleStart } from './roleStartResolver';

/** UI-SPEC error copy key for locked/disabled deep links (D-17). */
export const MODULE_UNAVAILABLE_MESSAGE_KEY = 'hub.moduleUnavailable' as const;

export type DeepLinkFallbackInput = {
  licenseStatus: LicenseStatus | undefined | null;
  level: UserLevel | undefined;
  callCenterEnabled?: boolean;
  apiPath?: string | null;
};

export type DeepLinkFallbackResult = {
  path: string;
  messageKey: typeof MODULE_UNAVAILABLE_MESSAGE_KEY;
};

/**
 * Smart fallback when deep-linking into a locked or disabled module (D-17).
 * Returns null when the module is accessible (active / unknown).
 */
export function resolveDeepLinkFallback(
  input: DeepLinkFallbackInput,
): DeepLinkFallbackResult | null {
  if (input.licenseStatus !== 'locked' && input.licenseStatus !== 'disabled') {
    return null;
  }

  return {
    path: resolveRoleStart(input.level, {
      callCenterEnabled: input.callCenterEnabled,
      apiPath: input.apiPath,
      lockedDeepLink: input.licenseStatus,
    }),
    messageKey: MODULE_UNAVAILABLE_MESSAGE_KEY,
  };
}
