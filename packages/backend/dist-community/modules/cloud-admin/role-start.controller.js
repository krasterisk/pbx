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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceRoleStartController = exports.PlatformRoleStartController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const superadmin_guard_1 = require("../auth/superadmin.guard");
const user_model_1 = require("../users/user.model");
const role_start_service_1 = require("./role-start.service");
const modules_registry_service_1 = require("./modules-registry.service");
const role_start_dto_1 = require("./dto/role-start.dto");
let PlatformRoleStartController = class PlatformRoleStartController {
    roleStartService;
    constructor(roleStartService) {
        this.roleStartService = roleStartService;
    }
    listDefaults() {
        return this.roleStartService.listDefaults();
    }
    upsertDefaults(dto) {
        return this.roleStartService.upsertDefaults(dto.rows);
    }
};
exports.PlatformRoleStartController = PlatformRoleStartController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List platform role→start defaults' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlatformRoleStartController.prototype, "listDefaults", null);
__decorate([
    (0, common_1.Put)(),
    (0, swagger_1.ApiOperation)({ summary: 'Upsert platform role→start defaults (SuperAdmin only)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [role_start_dto_1.UpsertRoleStartDefaultsDto]),
    __metadata("design:returntype", void 0)
], PlatformRoleStartController.prototype, "upsertDefaults", null);
exports.PlatformRoleStartController = PlatformRoleStartController = __decorate([
    (0, swagger_1.ApiTags)('Cloud Admin — Role Start'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, superadmin_guard_1.SuperAdminGuard),
    (0, common_1.Controller)('cloud-admin/role-start'),
    __metadata("design:paramtypes", [role_start_service_1.RoleStartService])
], PlatformRoleStartController);
let MarketplaceRoleStartController = class MarketplaceRoleStartController {
    roleStartService;
    modulesService;
    constructor(roleStartService, modulesService) {
        this.roleStartService = roleStartService;
        this.modulesService = modulesService;
    }
    /**
     * Resolved start path for current user (tenant override → platform → D-16).
     */
    async getRoleStart(req) {
        const level = req.user?.level;
        const tenantId = req.user?.tenant_id;
        let callCenterEnabled = true;
        if (tenantId) {
            const catalog = await this.modulesService.getHubCatalogForTenant(tenantId);
            const cc = catalog.find((m) => m.code === 'callcenter');
            callCenterEnabled = !cc || cc.licenseStatus === 'active';
        }
        const path = await this.roleStartService.resolveStart(level, tenantId, { callCenterEnabled });
        return { path, user_level: level, callCenterEnabled };
    }
    listOverrides(req) {
        const tenantId = this.requireTenantId(req);
        return this.roleStartService.listTenantOverrides(tenantId);
    }
    upsertOverrides(req, dto) {
        const tenantId = this.requireTenantAdmin(req);
        // Never accept body.tenant_id — bind from JWT only (T-08-04)
        return this.roleStartService.upsertTenantOverrides(tenantId, dto.rows);
    }
    requireTenantId(req) {
        const tenantId = req.user?.tenant_id;
        if (!tenantId)
            throw new common_1.ForbiddenException('Tenant binding required');
        return tenantId;
    }
    requireTenantAdmin(req) {
        const tenantId = this.requireTenantId(req);
        const level = req.user?.level;
        if (level !== user_model_1.UserLevel.ADMIN && level !== user_model_1.UserLevel.SUPERADMIN) {
            throw new common_1.ForbiddenException('Tenant ADMIN required');
        }
        return tenantId;
    }
};
exports.MarketplaceRoleStartController = MarketplaceRoleStartController;
__decorate([
    (0, common_1.Get)('role-start'),
    (0, swagger_1.ApiOperation)({ summary: 'Resolve role→start path for current user' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MarketplaceRoleStartController.prototype, "getRoleStart", null);
__decorate([
    (0, common_1.Get)('role-start/overrides'),
    (0, swagger_1.ApiOperation)({ summary: 'List tenant role→start overrides for current tenant' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MarketplaceRoleStartController.prototype, "listOverrides", null);
__decorate([
    (0, common_1.Put)('role-start'),
    (0, swagger_1.ApiOperation)({ summary: 'Upsert tenant role→start overrides (JWT tenant only)' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, role_start_dto_1.UpsertTenantRoleStartDto]),
    __metadata("design:returntype", void 0)
], MarketplaceRoleStartController.prototype, "upsertOverrides", null);
exports.MarketplaceRoleStartController = MarketplaceRoleStartController = __decorate([
    (0, swagger_1.ApiTags)('Marketplace'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('marketplace'),
    __metadata("design:paramtypes", [role_start_service_1.RoleStartService,
        modules_registry_service_1.ModulesRegistryService])
], MarketplaceRoleStartController);
//# sourceMappingURL=role-start.controller.js.map