import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AutodialIntegrationKeyService, type AutodialIntegrationScope } from './autodial-integration-key.service';

export const AutodialApiScope = (scope: AutodialIntegrationScope) => SetMetadata('autodialApiScope', scope);
@Injectable()
export class AutodialIntegrationKeyGuard implements CanActivate {
  constructor(private readonly keys: AutodialIntegrationKeyService, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization;
    if (typeof auth !== 'string' || !auth.startsWith('Bearer krac_v1_')) throw new UnauthorizedException();
    req.user = await this.keys.authenticate(auth.slice(7));
    const scope = this.reflector.getAllAndOverride<AutodialIntegrationScope>('autodialApiScope', [context.getHandler(), context.getClass()]);
    if (!scope || !req.user.integration_scopes.includes(scope)) throw new ForbiddenException({ code: 'AC_API_SCOPE_REQUIRED', scope });
    return true;
  }
}
