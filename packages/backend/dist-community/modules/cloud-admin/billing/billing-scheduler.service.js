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
var BillingSchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const billing_balance_model_1 = require("./models/billing-balance.model");
const billing_balance_service_1 = require("./billing-balance.service");
const tenant_model_1 = require("../tenant.model");
const tenant_module_model_1 = require("../tenant-module.model");
const module_registry_model_1 = require("../module-registry.model");
/**
 * BillingSchedulerService — scheduled billing jobs.
 *
 * Jobs:
 *   - Monthly subscription charges (1st of each month at 03:00)
 *   - Daily trial expiry check (every day at 01:00)
 *   - Blocking tenants with negative balance (every 6 hours)
 */
let BillingSchedulerService = BillingSchedulerService_1 = class BillingSchedulerService {
    balanceModel;
    tenantModel;
    tenantModuleModel;
    moduleRegistryModel;
    balanceService;
    logger = new common_1.Logger(BillingSchedulerService_1.name);
    constructor(balanceModel, tenantModel, tenantModuleModel, moduleRegistryModel, balanceService) {
        this.balanceModel = balanceModel;
        this.tenantModel = tenantModel;
        this.tenantModuleModel = tenantModuleModel;
        this.moduleRegistryModel = moduleRegistryModel;
        this.balanceService = balanceService;
    }
    // ─── Trial expiry ──────────────────────────────────────────────────────────
    /**
     * Every day at 01:00 — suspend tenants whose trial has expired.
     */
    async checkTrialExpiry() {
        this.logger.log('[Scheduler] Checking trial expiry...');
        const expired = await this.tenantModel.findAll({
            where: {
                status: 'trial',
                trial_ends_at: { [sequelize_2.Op.lt]: new Date() },
            },
        });
        for (const tenant of expired) {
            await tenant.update({ status: 'suspended' });
            this.logger.warn(`[Scheduler] Trial expired → suspended tenant #${tenant.id} (${tenant.name})`);
        }
        this.logger.log(`[Scheduler] Trial expiry check done. Suspended: ${expired.length}`);
    }
    // ─── Monthly subscription charge ───────────────────────────────────────────
    /**
     * 1st of each month at 03:00 — charge active tenants for enabled modules.
     */
    async chargeMonthlySubscriptions() {
        this.logger.log('[Scheduler] Monthly subscription charge started');
        const activeTenants = await this.tenantModel.findAll({
            where: { status: 'active' },
        });
        for (const tenant of activeTenants) {
            try {
                await this.chargeTenant(tenant);
            }
            catch (err) {
                this.logger.error(`[Scheduler] Failed to charge tenant #${tenant.id}: ${err.message}`);
            }
        }
        this.logger.log('[Scheduler] Monthly subscription charge complete');
    }
    async chargeTenant(tenant) {
        // Get all enabled paid modules for this tenant
        const modules = await this.tenantModuleModel.findAll({
            where: { tenant_id: tenant.id, status: 'active' },
            include: [{ model: this.moduleRegistryModel, as: 'module' }],
        });
        let totalKopecks = 0;
        const descriptions = [];
        for (const tm of modules) {
            const registry = tm.module;
            if (!registry || !registry.price_monthly || Number(registry.price_monthly) === 0)
                continue;
            totalKopecks += Math.round(Number(registry.price_monthly) * 100);
            descriptions.push(`${registry.name}: ${Number(registry.price_monthly)} руб.`);
        }
        if (totalKopecks === 0)
            return;
        const amountRub = totalKopecks / 100;
        await this.balanceService.charge(tenant.id, amountRub, 0, // performed_by = system
        `Ежемесячная подписка: ${descriptions.join(', ')}`, undefined, 'charge');
        this.logger.log(`[Scheduler] Charged tenant #${tenant.id} (${tenant.name}): ${amountRub} RUB`);
    }
    // ─── Block negative balance tenants ────────────────────────────────────────
    /**
     * Every 6 hours — block active tenants whose balance has gone negative.
     */
    async blockNegativeBalanceTenants() {
        this.logger.log('[Scheduler] Checking for negative balances...');
        const negativeBalances = await this.balanceModel.findAll({
            where: {
                balance_kopecks: { [sequelize_2.Op.lt]: 0 },
                is_blocked: false,
                credit_limit_kopecks: 0,
            },
        });
        for (const balance of negativeBalances) {
            await balance.update({ is_blocked: true, blocked_at: new Date() });
            await this.tenantModel.update({ status: 'suspended' }, { where: { id: balance.tenant_id, status: 'active' } });
            this.logger.warn(`[Scheduler] Blocked tenant #${balance.tenant_id} (negative balance)`);
        }
        this.logger.log(`[Scheduler] Negative balance check done. Blocked: ${negativeBalances.length}`);
    }
};
exports.BillingSchedulerService = BillingSchedulerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_1AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BillingSchedulerService.prototype, "checkTrialExpiry", null);
__decorate([
    (0, schedule_1.Cron)('0 3 1 * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BillingSchedulerService.prototype, "chargeMonthlySubscriptions", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_6_HOURS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BillingSchedulerService.prototype, "blockNegativeBalanceTenants", null);
exports.BillingSchedulerService = BillingSchedulerService = BillingSchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(billing_balance_model_1.BillingBalance)),
    __param(1, (0, sequelize_1.InjectModel)(tenant_model_1.Tenant)),
    __param(2, (0, sequelize_1.InjectModel)(tenant_module_model_1.TenantModule)),
    __param(3, (0, sequelize_1.InjectModel)(module_registry_model_1.ModuleRegistry)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, billing_balance_service_1.BillingBalanceService])
], BillingSchedulerService);
//# sourceMappingURL=billing-scheduler.service.js.map