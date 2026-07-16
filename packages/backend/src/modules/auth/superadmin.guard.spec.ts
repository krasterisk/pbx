import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './superadmin.guard';
import { UserLevel } from '../users/user.model';

function mockContext(user: { level?: number } | null | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  it('allows user.level === 0 (SUPERADMIN)', () => {
    expect(guard.canActivate(mockContext({ level: UserLevel.SUPERADMIN }))).toBe(true);
  });

  it('rejects user.level !== 0 with ForbiddenException', () => {
    expect(() => guard.canActivate(mockContext({ level: UserLevel.ADMIN }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects missing user with ForbiddenException', () => {
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(ForbiddenException);
  });
});
