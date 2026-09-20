"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleAccessGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const requires_module_decorator_1 = require("./requires-module.decorator");
const modules_registry_service_1 = require("./modules-registry.service");
const product_access_policy_1 = require("./product-access-policy");
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
let ModuleAccessGuard = class ModuleAccessGuard {
    reflector;
    modulesService;
    constructor(reflector, modulesService) {
        this.reflector = reflector;
        this.modulesService = modulesService;
    }
    async canActivate(context) {
        const moduleCode = this.reflector.getAllAndOverride(requires_module_decorator_1.REQUIRED_MODULE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        // No @RequiresModule() annotation — always allow
        if (!moduleCode)
            return true;
        const { user } = context.switchToHttp().getRequest();
        if (!user || user.vpbx_user_uid === null || user.vpbx_user_uid === undefined) {
            throw new common_1.UnauthorizedException();
        }
        if ((0, product_access_policy_1.isAiProductCode)(moduleCode)) {
            const decision = await this.modulesService.resolveAiProductAccess(user.vpbx_user_uid, moduleCode);
            if (!decision.allowed) {
                throw new common_1.ForbiddenException({
                    code: decision.reason,
                    product: decision.product,
                    policyRevision: decision.policyRevision,
                });
            }
            return true;
        }
        // SuperAdmin bypasses module access checks
        if (user.level === 0)
            return true;
        const hasAccess = await this.modulesService.tenantHasModule(user.vpbx_user_uid, moduleCode);
        if (!hasAccess) {
            throw new common_1.ForbiddenException(`Модуль «${moduleCode}» не подключён для вашего аккаунта. Обратитесь к администратору.`);
        }
        return true;
    }
};
exports.ModuleAccessGuard = ModuleAccessGuard;
exports.ModuleAccessGuard = ModuleAccessGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        modules_registry_service_1.ModulesRegistryService])
], ModuleAccessGuard);
//# sourceMappingURL=module-access.guard.js.map