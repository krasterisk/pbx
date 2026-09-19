import { SetMetadata } from '@nestjs/common';

export const REQUIRED_MODULE_KEY = 'required_module';

/**
 * Marks a controller or route as requiring a specific module to be active for the tenant.
 *
 * Usage:
 *   @RequiresModule('voice_robot')
 *   @Get()
 *   findAll() { ... }
 *
 * Combined with ModuleAccessGuard, this returns 403 if the tenant
 * doesn't have the module active in tenant_modules.
 * Legacy codes retain BOX/OPENSOURCE behavior; new AI product codes use
 * the same fail-closed policy in every deployment mode.
 */
export const RequiresModule = (moduleCode: string) =>
  SetMetadata(REQUIRED_MODULE_KEY, moduleCode);
