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
exports.BillingTenantController = exports.BillingAdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const superadmin_guard_1 = require("../../auth/superadmin.guard");
const billing_balance_service_1 = require("./billing-balance.service");
class DepositDto {
    amount; // рубли
    description;
}
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], DepositDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    __metadata("design:type", String)
], DepositDto.prototype, "description", void 0);
class ChargeDto {
    amount;
    description;
    module_code;
}
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], ChargeDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    __metadata("design:type", String)
], ChargeDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ChargeDto.prototype, "module_code", void 0);
// ──────────────────────────────────────────────────────────
// SuperAdmin: /api/cloud-admin/billing/tenants/:id/*
// ──────────────────────────────────────────────────────────
let BillingAdminController = class BillingAdminController {
    billingService;
    constructor(billingService) {
        this.billingService = billingService;
    }
    getBalance(id) {
        return this.billingService.getBalance(id);
    }
    getTransactions(id, limit, offset) {
        return this.billingService.getTransactions(id, Number(limit) || 50, Number(offset) || 0);
    }
    deposit(id, dto, req) {
        return this.billingService.deposit(id, dto.amount, req.user.sub, dto.description);
    }
    charge(id, dto, req) {
        return this.billingService.charge(id, dto.amount, req.user.sub, dto.description, dto.module_code);
    }
};
exports.BillingAdminController = BillingAdminController;
__decorate([
    (0, common_1.Get)('balance'),
    (0, swagger_1.ApiOperation)({ summary: 'Баланс тенанта' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], BillingAdminController.prototype, "getBalance", null);
__decorate([
    (0, common_1.Get)('transactions'),
    (0, swagger_1.ApiOperation)({ summary: 'История транзакций тенанта' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", void 0)
], BillingAdminController.prototype, "getTransactions", null);
__decorate([
    (0, common_1.Post)('deposit'),
    (0, swagger_1.ApiOperation)({ summary: 'Пополнить баланс тенанта' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, DepositDto, Object]),
    __metadata("design:returntype", void 0)
], BillingAdminController.prototype, "deposit", null);
__decorate([
    (0, common_1.Post)('charge'),
    (0, swagger_1.ApiOperation)({ summary: 'Ручное списание / корректировка' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, ChargeDto, Object]),
    __metadata("design:returntype", void 0)
], BillingAdminController.prototype, "charge", null);
exports.BillingAdminController = BillingAdminController = __decorate([
    (0, swagger_1.ApiTags)('Cloud Admin — Billing'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, superadmin_guard_1.SuperAdminGuard),
    (0, common_1.Controller)('cloud-admin/billing/tenants/:id'),
    __metadata("design:paramtypes", [billing_balance_service_1.BillingBalanceService])
], BillingAdminController);
// ──────────────────────────────────────────────────────────
// Tenant Admin: /api/billing/*  (read-only)
// ──────────────────────────────────────────────────────────
let BillingTenantController = class BillingTenantController {
    billingService;
    constructor(billingService) {
        this.billingService = billingService;
    }
    /** Получить свой баланс — tenantId из vpbx_user_uid */
    async getMyBalance(req) {
        // Resolve tenant_id from vpbx_user_uid via balance table (or use tenant lookup)
        // Simplified: we use vpbx_user_uid directly to find a tenant
        // Full solution: inject TenantsService and call findByVpbxUid
        const vpbxUid = req.user.vpbx_user_uid;
        // For now we pass vpbx_user_uid as proxy tenant_id (matches billing_balances.tenant_id)
        return this.billingService.getBalance(vpbxUid);
    }
    async getMyTransactions(req, limit, offset) {
        return this.billingService.getTransactions(req.user.vpbx_user_uid, Number(limit) || 50, Number(offset) || 0);
    }
};
exports.BillingTenantController = BillingTenantController;
__decorate([
    (0, common_1.Get)('balance'),
    (0, swagger_1.ApiOperation)({ summary: 'Мой баланс' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingTenantController.prototype, "getMyBalance", null);
__decorate([
    (0, common_1.Get)('transactions'),
    (0, swagger_1.ApiOperation)({ summary: 'Моя история платежей' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], BillingTenantController.prototype, "getMyTransactions", null);
exports.BillingTenantController = BillingTenantController = __decorate([
    (0, swagger_1.ApiTags)('Billing — Tenant'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('billing'),
    __metadata("design:paramtypes", [billing_balance_service_1.BillingBalanceService])
], BillingTenantController);
//# sourceMappingURL=billing.controller.js.map