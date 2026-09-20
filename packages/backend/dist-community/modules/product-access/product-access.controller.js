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
exports.TenantProductActivationController = exports.InstallationLicenseController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const superadmin_guard_1 = require("../auth/superadmin.guard");
const user_model_1 = require("../users/user.model");
const product_access_policy_1 = require("../cloud-admin/product-access-policy");
const product_access_service_1 = require("./product-access.service");
let InstallationLicenseController = class InstallationLicenseController {
    products;
    constructor(products) {
        this.products = products;
    }
    importLicense(userUid, body, req) {
        const target = Number(userUid);
        if (!Number.isSafeInteger(target) || target < 0 || String(target) !== userUid
            || !body || typeof body !== 'object' || Array.isArray(body)
            || Object.keys(body).some((key) => !['payload', 'signature', 'replace'].includes(key))
            || (body.replace !== undefined && typeof body.replace !== 'boolean')) {
            throw new common_1.BadRequestException({ code: 'license_import_invalid' });
        }
        return this.products.importLicense(target, { payload: body.payload, signature: body.signature }, req.user.sub, body.replace === true);
    }
};
exports.InstallationLicenseController = InstallationLicenseController;
__decorate([
    (0, common_1.Post)('tenants/:userUid/import'),
    __param(0, (0, common_1.Param)('userUid')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], InstallationLicenseController.prototype, "importLicense", null);
exports.InstallationLicenseController = InstallationLicenseController = __decorate([
    (0, swagger_1.ApiTags)('AI Product License'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, superadmin_guard_1.SuperAdminGuard),
    (0, common_1.Controller)('cloud-admin/ai-products/licenses'),
    __metadata("design:paramtypes", [product_access_service_1.ProductAccessService])
], InstallationLicenseController);
let TenantProductActivationController = class TenantProductActivationController {
    products;
    constructor(products) {
        this.products = products;
    }
    setActivation(code, body, req) {
        if (!(0, product_access_policy_1.isAiProductCode)(code) || !body || typeof body !== 'object' || Array.isArray(body)
            || Object.keys(body).length !== 1 || typeof body.enabled !== 'boolean') {
            throw new common_1.BadRequestException({ code: 'product_activation_invalid' });
        }
        const user = req.user;
        if (!user || !Number.isSafeInteger(user.vpbx_user_uid)
            || user.vpbx_user_uid < 0
            || (user.level !== user_model_1.UserLevel.ADMIN && user.level !== user_model_1.UserLevel.SUPERADMIN)) {
            throw new common_1.ForbiddenException({ code: 'tenant_admin_required' });
        }
        return this.products.setActivation(user.vpbx_user_uid, code, body.enabled, user.sub);
    }
};
exports.TenantProductActivationController = TenantProductActivationController;
__decorate([
    (0, common_1.Put)(':code/activation'),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], TenantProductActivationController.prototype, "setActivation", null);
exports.TenantProductActivationController = TenantProductActivationController = __decorate([
    (0, swagger_1.ApiTags)('AI Product Activation'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('marketplace/ai-products'),
    __metadata("design:paramtypes", [product_access_service_1.ProductAccessService])
], TenantProductActivationController);
//# sourceMappingURL=product-access.controller.js.map