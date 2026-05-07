import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_MODULE_KEY } from './requires-module.decorator';
import { ModulesRegistryService } from './modules-registry.service';
import type { JwtPayloadUser } from '../auth/auth.service';

/**
 * ModuleAccessGuard — checks that the requesting tenant has the required module active.
 *
 * Use with @RequiresModule('module_code') on routes or controllers.
 * In BOX/OPENSOURCE mode the check is always skipped (all modules unlocked).
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

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayloadUser }>();

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
