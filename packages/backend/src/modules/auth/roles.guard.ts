import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { UserLevel } from '../users/user.model';
import type { JwtPayloadUser } from './auth.service';

/**
 * RolesGuard — checks that req.user.level is in the list of @Roles(...) values.
 *
 * SUPERADMIN (level=0) bypasses all @Roles checks — they can access
 * everything within tenant-scoped endpoints if needed.
 * (Cloud-admin endpoints use SuperAdminGuard directly.)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserLevel[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator — any authenticated user passes
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayloadUser }>();

    if (!user) {
      throw new ForbiddenException('No user in request context');
    }

    // SuperAdmin bypasses role checks on tenant-scoped endpoints
    if (user.level === UserLevel.SUPERADMIN) {
      return true;
    }

    if (!requiredRoles.includes(user.level)) {
      throw new ForbiddenException(
        `Недостаточно прав. Требуется уровень: ${requiredRoles.join(' или ')}`,
      );
    }

    return true;
  }
}
