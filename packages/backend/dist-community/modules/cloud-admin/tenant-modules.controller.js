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
exports.MarketplaceController = exports.AiProductCatalogMaintenanceController = exports.TenantModulesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const superadmin_guard_1 = require("../auth/superadmin.guard");
const modules_registry_service_1 = require("./modules-registry.service");
const user_model_1 = require("../users/user.model");
const module_access_guard_1 = require("./module-access.guard");
const requires_module_decorator_1 = require("./requires-module.decorator");
let TenantModulesController = class TenantModulesController {
    modulesService;
    constructor(modulesService) {
        this.modulesService = modulesService;
    }
    findAll(tenantId) {
        return this.modulesService.getTenantModules(tenantId);
    }
    activate(tenantId, moduleCode) {
        return this.modulesService.activateModule(tenantId, moduleCode);
    }
    async deactivate(tenantId, moduleCode) {
        await this.modulesService.deactivateModule(tenantId, moduleCode);
        return { success: true };
    }
};
exports.TenantModulesController = TenantModulesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Список активированных модулей тенанта' }),
    __param(0, (0, common_1.Param)('tenantId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TenantModulesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(':moduleCode'),
    (0, swagger_1.ApiOperation)({ summary: 'Активировать модуль для тенанта' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Модуль активирован' }),
    __param(0, (0, common_1.Param)('tenantId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('moduleCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], TenantModulesController.prototype, "activate", null);
__decorate([
    (0, common_1.Delete)(':moduleCode'),
    (0, swagger_1.ApiOperation)({ summary: 'Деактивировать модуль (нельзя для core-модулей)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Модуль деактивирован' }),
    __param(0, (0, common_1.Param)('tenantId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('moduleCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], TenantModulesController.prototype, "deactivate", null);
exports.TenantModulesController = TenantModulesController = __decorate([
    (0, swagger_1.ApiTags)('Cloud Admin — Modules'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, superadmin_guard_1.SuperAdminGuard),
    (0, common_1.Controller)('cloud-admin/tenants/:tenantId/modules'),
    __metadata("design:paramtypes", [modules_registry_service_1.ModulesRegistryService])
], TenantModulesController);
/** Explicit admin maintenance; never run during normal catalog bootstrap. */
let AiProductCatalogMaintenanceController = class AiProductCatalogMaintenanceController {
    modulesService;
    constructor(modulesService) {
        this.modulesService = modulesService;
    }
    async unpublishUnreleasedDrafts() {
        return { changed: await this.modulesService.unpublishUnreleasedAiDrafts() };
    }
};
exports.AiProductCatalogMaintenanceController = AiProductCatalogMaintenanceController;
__decorate([
    (0, common_1.Post)('unpublish-unreleased-drafts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AiProductCatalogMaintenanceController.prototype, "unpublishUnreleasedDrafts", null);
exports.AiProductCatalogMaintenanceController = AiProductCatalogMaintenanceController = __decorate([
    (0, swagger_1.ApiTags)('Cloud Admin — Modules'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, superadmin_guard_1.SuperAdminGuard),
    (0, common_1.Controller)('cloud-admin/ai-products'),
    __metadata("design:paramtypes", [modules_registry_service_1.ModulesRegistryService])
], AiProductCatalogMaintenanceController);
/**
 * Marketplace controller — visible to Tenant Admins
 */
let MarketplaceController = class MarketplaceController {
    modulesService;
    constructor(modulesService) {
        this.modulesService = modulesService;
    }
    /** Полный каталог модулей (для страницы Marketplace) */
    findAll() {
        return this.modulesService.findAll();
    }
    /** Current server-side projection; grants are visible, but A1 activation is off. */
    async getAiProductsStatus(req) {
        const uid = req.user?.vpbx_user_uid;
        if (uid === null || uid === undefined)
            throw new common_1.ForbiddenException('Tenant binding required');
        return Promise.all([
            this.modulesService.resolveAiProductAccess(uid, 'ai_voice_robots'),
            this.modulesService.resolveAiProductAccess(uid, 'speech_analytics'),
        ]);
    }
    checkAiVoiceRobotsAccess() {
        return { allowed: true };
    }
    checkSpeechAnalyticsAccess() {
        return { allowed: true };
    }
    /**
     * Мои модули — модули текущего тенанта (читаем tenant_id из JWT).
     * Используется для:
     *   1. Страницы «Мои модули»
     *   2. Sidebar — фильтрация пунктов меню по активным модулям
     */
    async getMyModules(req) {
        const tenantId = req.user.tenant_id;
        if (!tenantId)
            return [];
        return this.modulesService.getTenantModules(tenantId);
    }
    /**
     * Hub catalog with server-computed licenseStatus (D-07 / D-17).
     * Tenant id from JWT only (T-08-04).
     */
    async getHubCatalog(req) {
        const tenantId = req.user?.tenant_id ?? 0;
        return this.modulesService.getHubCatalogForTenant(tenantId);
    }
    /**
     * Tenant enable Hub module — JWT tenant_id only; no membership edits (D-22).
     */
    async enableHubModule(req, code) {
        const tenantId = this.requireTenantAdmin(req);
        return this.modulesService.setTenantHubModuleStatus(tenantId, code, 'active');
    }
    async disableHubModule(req, code) {
        const tenantId = this.requireTenantAdmin(req);
        return this.modulesService.setTenantHubModuleStatus(tenantId, code, 'inactive');
    }
    requireTenantAdmin(req) {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            throw new common_1.ForbiddenException('Tenant binding required');
        }
        const level = req.user?.level;
        if (level !== user_model_1.UserLevel.ADMIN && level !== user_model_1.UserLevel.SUPERADMIN) {
            throw new common_1.ForbiddenException('Tenant ADMIN required');
        }
        return tenantId;
    }
};
exports.MarketplaceController = MarketplaceController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Каталог всех доступных модулей' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MarketplaceController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('ai-products/status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "getAiProductsStatus", null);
__decorate([
    (0, common_1.Get)('ai-products/voice-robots/access'),
    (0, common_1.UseGuards)(module_access_guard_1.ModuleAccessGuard),
    (0, requires_module_decorator_1.RequiresModule)('ai_voice_robots'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MarketplaceController.prototype, "checkAiVoiceRobotsAccess", null);
__decorate([
    (0, common_1.Get)('ai-products/speech-analytics/access'),
    (0, common_1.UseGuards)(module_access_guard_1.ModuleAccessGuard),
    (0, requires_module_decorator_1.RequiresModule)('speech_analytics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MarketplaceController.prototype, "checkSpeechAnalyticsAccess", null);
__decorate([
    (0, common_1.Get)('my-modules'),
    (0, swagger_1.ApiOperation)({ summary: 'Активные модули текущего тенанта' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "getMyModules", null);
__decorate([
    (0, common_1.Get)('hub-catalog'),
    (0, swagger_1.ApiOperation)({ summary: 'Hub modules with licenseStatus for current tenant' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "getHubCatalog", null);
__decorate([
    (0, common_1.Post)('hub-modules/:code/enable'),
    (0, swagger_1.ApiOperation)({ summary: 'Enable Hub module for current tenant' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "enableHubModule", null);
__decorate([
    (0, common_1.Post)('hub-modules/:code/disable'),
    (0, swagger_1.ApiOperation)({ summary: 'Disable Hub module for current tenant' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "disableHubModule", null);
exports.MarketplaceController = MarketplaceController = __decorate([
    (0, swagger_1.ApiTags)('Marketplace'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('marketplace'),
    __metadata("design:paramtypes", [modules_registry_service_1.ModulesRegistryService])
], MarketplaceController);
//# sourceMappingURL=tenant-modules.controller.js.map