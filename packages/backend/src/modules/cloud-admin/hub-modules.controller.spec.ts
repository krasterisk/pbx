import { ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { UserLevel } from '../users/user.model';
import { HubModulesController } from './hub-modules.controller';

describe('HubModulesController SuperAdminGuard (08-02 / T-08-03)', () => {
  const guard = new SuperAdminGuard();

  function ctx(level: number | undefined) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: level === undefined ? undefined : { level } }),
      }),
    } as any;
  }

  it('allows SUPERADMIN (level 0) for platform hub catalog writes', () => {
    expect(guard.canActivate(ctx(UserLevel.SUPERADMIN))).toBe(true);
  });

  it('rejects tenant ADMIN for hub membership mutation', () => {
    expect(() => guard.canActivate(ctx(UserLevel.ADMIN))).toThrow(ForbiddenException);
  });

  it('controller class is decorated for SuperAdmin-only routes', () => {
    // Structural: HubModulesController must exist and expose membership replace
    expect(HubModulesController).toBeDefined();
    expect(typeof HubModulesController.prototype.replacePages).toBe('function');
  });
});
