/**
 * Call-center supervisor/admin gate.
 *
 * UserLevel is inverted privilege (SUPERADMIN=0, ADMIN=1, SUPERVISOR=3).
 * Numeric `level >= 3` would block ADMIN and allow READONLY — use set membership.
 */
import { ForbiddenException } from '@nestjs/common';
import { UserLevel } from '../users/user.model';

export const CC_SUPERVISOR_LEVELS = new Set<number>([
  UserLevel.SUPERADMIN,
  UserLevel.ADMIN,
  UserLevel.SUPERVISOR,
]);

export function isSupervisorUser(user: { level?: number } | null | undefined): boolean {
  return CC_SUPERVISOR_LEVELS.has(Number(user?.level));
}

export function assertSupervisor(user: { level?: number } | null | undefined): void {
  if (!isSupervisorUser(user)) {
    throw new ForbiddenException('Supervisor access required');
  }
}
