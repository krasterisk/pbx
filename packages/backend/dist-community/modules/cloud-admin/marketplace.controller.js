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
exports.MarketplacePurchaseController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const user_model_1 = require("../users/user.model");
const purchase_module_dto_1 = require("./dto/purchase-module.dto");
const purchase_module_service_1 = require("./purchase-module.service");
const tenants_service_1 = require("./tenants.service");
/**
 * Marketplace purchase — tenant ADMIN JWT only (NAV-07 / D-23).
 * Catalog/my-modules/hub endpoints remain on TenantModulesController.
 */
let MarketplacePurchaseController = class MarketplacePurchaseController {
    purchaseService;
    tenantsService;
    constructor(purchaseService, tenantsService) {
        this.purchaseService = purchaseService;
        this.tenantsService = tenantsService;
    }
    async purchase(req, dto) {
        const tenantId = await this.requireTenantAdmin(req);
        const result = await this.purchaseService.purchase(tenantId, dto.moduleCode, req.user.sub);
        return { success: true, ...result };
    }
    /**
     * Tenant id from JWT only — never from body.
     * Fallback: resolve tenants.id via vpbx_user_uid when JWT lacks tenant_id
     * (payload currently carries vpbx_user_uid; billing/modules keys use tenants.id).
     */
    async requireTenantAdmin(req) {
        let tenantId = req.user?.tenant_id;
        if (!tenantId && req.user?.vpbx_user_uid) {
            const tenant = await this.tenantsService.findByVpbxUid(req.user.vpbx_user_uid);
            tenantId = tenant?.id;
        }
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
exports.MarketplacePurchaseController = MarketplacePurchaseController;
__decorate([
    (0, common_1.Post)('purchase'),
    (0, swagger_1.ApiOperation)({ summary: 'Purchase module — charge balance then activate' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Module purchased and activated' }),
    (0, swagger_1.ApiResponse)({ status: 402, description: 'Insufficient balance' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, purchase_module_dto_1.PurchaseModuleDto]),
    __metadata("design:returntype", Promise)
], MarketplacePurchaseController.prototype, "purchase", null);
exports.MarketplacePurchaseController = MarketplacePurchaseController = __decorate([
    (0, swagger_1.ApiTags)('Marketplace'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('marketplace'),
    __metadata("design:paramtypes", [purchase_module_service_1.PurchaseModuleService,
        tenants_service_1.TenantsService])
], MarketplacePurchaseController);
//# sourceMappingURL=marketplace.controller.js.map