import { UserLevel } from '@krasterisk/shared';

export interface RoleStartOptions {
  /** When false, CC role defaults fall back to Overview (D-16). Default true. */
  callCenterEnabled?: boolean;
  /**
   * Deep-link target that is locked/disabled (D-17).
   * When set, returns smart fallback (role-default / Overview) instead of the locked path.
   */
  lockedDeepLink?: string | null;
  /**
   * Server-resolved path from GET /marketplace/role-start
   * (already tenant override → platform default → D-16 on the server).
   * When present (and not locked), preferred over local inputs.
   */
  apiPath?: string | null;
  /**
   * Explicit tenant_role_start override (client preview / offline).
   * Precedence when apiPath absent: tenantOverride → platformDefault → local D-16.
   */
  tenantOverride?: string | null;
  /** Explicit platform role_start_defaults path (client preview / offline). */
  platformDefault?: string | null;
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

function firstNonEmpty(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    const trimmed = c?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * Resolve post-login / role→start path (D-04 / D-16) with CC-off and locked deep-link fallbacks (D-17).
 * Precedence: apiPath (server) → tenantOverride → platformDefault → local D-16.
 */
export function resolveRoleStart(
  level: UserLevel | undefined,
  opts: RoleStartOptions = {},
): string {
  const callCenterEnabled = opts.callCenterEnabled !== false;
  let path =
    firstNonEmpty(opts.apiPath, opts.tenantOverride, opts.platformDefault) ||
    roleDefaultPath(level);

  if (!callCenterEnabled && isCallCenterPath(path)) {
    path = OVERVIEW_PATH;
  }

  if (opts.lockedDeepLink) {
    // Locked deep-link → role-default (already CC-off adjusted), never the locked target
    return path;
  }

  return path;
}
