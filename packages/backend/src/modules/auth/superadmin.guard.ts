import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserLevel } from '../users/user.model';

/**
 * SuperAdminGuard — allows access ONLY for level=0 (SUPERADMIN).
 * Use on cloud-admin/* controllers that manage tenants across the platform.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user || user.level !== UserLevel.SUPERADMIN) {
      throw new ForbiddenException('SuperAdmin access required');
    }
    return true;
  }
}
