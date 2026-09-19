import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_MODULE_KEY } from './requires-module.decorator';
import { ModulesRegistryService } from './modules-registry.service';
import type { JwtPayloadUser } from '../auth/auth.service';
import { isAiProductCode } from './product-access-policy';

/**
 * ModuleAccessGuard — checks that the requesting tenant has the required module active.
 *
 * Use with @RequiresModule('module_code') on routes or controllers.
 * Legacy modules retain BOX behavior; commercial AI products use fail-closed policy.
 *
 * Usage example:
 *   @UseGuards(JwtAuthGuard, ModuleAccessGuard)
 *   @RequiresModule('voice_robot')
 *   @Get()
 *   findAll() { ... }
 */
@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly modulesService: ModulesRegistryService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleCode = this.reflector.getAllAndOverride<string>(REQUIRED_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @RequiresModule() annotation — always allow
    if (!moduleCode) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayloadUser }>();
    if (!user || user.vpbx_user_uid === null || user.vpbx_user_uid === undefined) {
      throw new UnauthorizedException();
    }

    if (isAiProductCode(moduleCode)) {
      const decision = await this.modulesService.resolveAiProductAccess(
        user.vpbx_user_uid, moduleCode,
      );
      if (!decision.allowed) {
        throw new ForbiddenException({
          code: decision.reason,
          product: decision.product,
          policyRevision: decision.policyRevision,
        });
      }
      return true;
    }

    // SuperAdmin bypasses module access checks
    if (user.level === 0) return true;

    const hasAccess = await this.modulesService.tenantHasModule(user.vpbx_user_uid, moduleCode);

    if (!hasAccess) {
      throw new ForbiddenException(
        `Модуль «${moduleCode}» не подключён для вашего аккаунта. Обратитесь к администратору.`,
      );
    }

    return true;
  }
}
