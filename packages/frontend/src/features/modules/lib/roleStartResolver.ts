import { UserLevel } from '@krasterisk/shared';

export interface RoleStartOptions {
  /** When false, CC role defaults fall back to Overview (D-16). Default true. */
  callCenterEnabled?: boolean;
  /**
   * Deep-link target that is locked/disabled (D-17).
   * When set, returns smart fallback (role-default / Overview) instead of the locked path.
   */
  lockedDeepLink?: string | null;
}

const OVERVIEW_PATH = '/';
const CC_AGENT_PATH = '/callcenter/agent';
const CC_SUPERVISOR_PATH = '/callcenter/supervisor';

function roleDefaultPath(level: UserLevel | undefined): string {
  switch (level) {
    case UserLevel.OPERATOR:
      return CC_AGENT_PATH;
    case UserLevel.SUPERVISOR:
      return CC_SUPERVISOR_PATH;
    case UserLevel.ADMIN:
    case UserLevel.SUPERADMIN:
    case UserLevel.READONLY:
    default:
      return OVERVIEW_PATH;
  }
}

function isCallCenterPath(path: string): boolean {
  return path.startsWith('/callcenter/');
}

/**
 * Resolve post-login / role→start path (D-16) with CC-off and locked deep-link fallbacks (D-17).
 */
export function resolveRoleStart(
  level: UserLevel | undefined,
  opts: RoleStartOptions = {},
): string {
  const callCenterEnabled = opts.callCenterEnabled !== false;
  let path = roleDefaultPath(level);

  if (!callCenterEnabled && isCallCenterPath(path)) {
    path = OVERVIEW_PATH;
  }

  if (opts.lockedDeepLink) {
    // Locked deep-link → role-default (already CC-off adjusted), never the locked target
    return path;
  }

  return path;
}
