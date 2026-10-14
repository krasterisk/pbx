import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeApiKeyEqual } from '../modules/dialplan-bridge/dialplan-api-key';

export interface StandaloneRobotRequest {
  headers: Record<string, string | string[] | undefined>;
  robotTenantUid?: number;
}

export function robotTenant(request: StandaloneRobotRequest): number {
  if (!Number.isSafeInteger(request.robotTenantUid) || request.robotTenantUid! < 0) {
    throw new UnauthorizedException();
  }
  return request.robotTenantUid!;
}

/** Only the loopback PHP session bridge knows this secret and supplies the tenant. */
@Injectable()
export class StandaloneRobotGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<StandaloneRobotRequest>();
    const supplied = request.headers['x-api-key'];
    if (typeof supplied !== 'string' || !timingSafeApiKeyEqual(
      this.config.get<string>('VOICE_ROBOTS_PUBLIC_API_KEY') || '', supplied,
    )) throw new UnauthorizedException();
    const tenant = request.headers['x-vpbx-user-uid'];
    if (typeof tenant !== 'string' || !/^(0|[1-9]\d*)$/.test(tenant)
      || !Number.isSafeInteger(Number(tenant))) throw new UnauthorizedException();
    request.robotTenantUid = Number(tenant);
    return true;
  }
}
