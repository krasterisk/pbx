"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequiresModule = exports.REQUIRED_MODULE_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRED_MODULE_KEY = 'required_module';
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
const RequiresModule = (moduleCode) => (0, common_1.SetMetadata)(exports.REQUIRED_MODULE_KEY, moduleCode);
exports.RequiresModule = RequiresModule;
//# sourceMappingURL=requires-module.decorator.js.map