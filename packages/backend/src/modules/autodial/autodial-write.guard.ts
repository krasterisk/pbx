import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserLevel } from '../users/user.model';

export function assertAutodialWriteRole(level: number | undefined): void {
  if (level !== UserLevel.SUPERADMIN && level !== UserLevel.ADMIN && level !== UserLevel.SUPERVISOR) {
    throw new ForbiddenException('Autodial changes require an administrator or supervisor');
  }
}

@Injectable()
export class AutodialWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ method: string; user?: { level: number } }>();
    if (request.method === 'GET' || request.method === 'HEAD') return true;
    assertAutodialWriteRole(request.user?.level);
    return true;
  }
}
