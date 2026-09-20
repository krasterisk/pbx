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
var PurchaseModuleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseModuleService = void 0;
const common_1 = require("@nestjs/common");
const billing_balance_service_1 = require("./billing/billing-balance.service");
const modules_registry_service_1 = require("./modules-registry.service");
/**
 * Tenant module purchase — server-side price → charge balance → activate (NAV-07 / D-23).
 * No PCI / card processor — internal ledger only.
 */
let PurchaseModuleService = PurchaseModuleService_1 = class PurchaseModuleService {
    billing;
    modules;
    logger = new common_1.Logger(PurchaseModuleService_1.name);
    constructor(billing, modules) {
        this.billing = billing;
        this.modules = modules;
    }
    /**
     * Purchase and activate a module for a tenant.
     * Amount is always resolved server-side — never trust client price/paid flags.
     */
    async purchase(tenantId, moduleCode, actorUserId) {
        const offer = await this.modules.resolvePurchaseOffer(moduleCode);
        const alreadyActive = await this.modules.isModuleActiveForTenant(tenantId, offer.code);
        if (alreadyActive) {
            throw new common_1.BadRequestException({
                code: 'ALREADY_ACTIVE',
                message: `Module ${offer.code} is already active`,
            });
        }
        const amountRub = offer.priceRub;
        if (amountRub > 0) {
            const balance = await this.billing.getBalance(tenantId);
            const available = Number(balance.balance_kopecks) + Number(balance.credit_limit_kopecks);
            const needed = Math.round(amountRub * 100);
            if (available < needed) {
                throw new common_1.HttpException({
                    statusCode: common_1.HttpStatus.PAYMENT_REQUIRED,
                    code: 'INSUFFICIENT_BALANCE',
                    message: 'Insufficient balance to purchase module',
                }, common_1.HttpStatus.PAYMENT_REQUIRED);
            }
            await this.billing.charge(tenantId, amountRub, actorUserId, `Purchase module ${offer.code}`, offer.code);
        }
        try {
            await this.modules.activateModule(tenantId, offer.code);
        }
        catch (err) {
            if (amountRub > 0) {
                this.logger.error(`activateModule failed after charge for tenant #${tenantId} module ${offer.code}: ${err.message}`);
                try {
                    await this.billing.deposit(tenantId, amountRub, actorUserId, `Refund compensate purchase ${offer.code}`);
                }
                catch (compensateErr) {
                    this.logger.error(`Failed to compensate charge for tenant #${tenantId} module ${offer.code}: ${compensateErr.message}`);
                }
            }
            throw err;
        }
        return {
            moduleCode: offer.code,
            moduleName: offer.name,
            amountRub,
        };
    }
};
exports.PurchaseModuleService = PurchaseModuleService;
exports.PurchaseModuleService = PurchaseModuleService = PurchaseModuleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [billing_balance_service_1.BillingBalanceService,
        modules_registry_service_1.ModulesRegistryService])
], PurchaseModuleService);
//# sourceMappingURL=purchase-module.service.js.map