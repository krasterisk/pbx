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
var BankWebhookService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankWebhookService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const mailer_service_1 = require("../../mailer/mailer.service");
const billing_balance_service_1 = require("./billing-balance.service");
const tenant_model_1 = require("../tenant.model");
const tenant_module_model_1 = require("../tenant-module.model");
/**
 * BankWebhookService — processes incoming bank payment notifications.
 *
 * Flow:
 *   1. Validate the webhook payload
 *   2. Deposit funds into the tenant's billing balance
 *   3. Activate any pending modules if balance is now sufficient
 *   4. Send confirmation email to tenant admin
 */
let BankWebhookService = BankWebhookService_1 = class BankWebhookService {
    tenantModel;
    tenantModuleModel;
    balanceService;
    mailerService;
    sequelize;
    logger = new common_1.Logger(BankWebhookService_1.name);
    constructor(tenantModel, tenantModuleModel, balanceService, mailerService, sequelize) {
        this.tenantModel = tenantModel;
        this.tenantModuleModel = tenantModuleModel;
        this.balanceService = balanceService;
        this.mailerService = mailerService;
        this.sequelize = sequelize;
    }
    /**
     * Process a payment notification from the bank.
     * @param dto — bank webhook payload (validated by controller)
     */
    async processPayment(dto) {
        this.logger.log(`[BankWebhook] Incoming payment: ${JSON.stringify(dto)}`);
        // Resolve amount in rubles
        const amountRub = Number(dto.amountRub ?? dto.amount ?? 0);
        if (!amountRub || amountRub <= 0) {
            this.logger.warn('[BankWebhook] Zero or missing amount — skipping');
            return { ok: false, message: 'Zero amount' };
        }
        // Try to match tenant by INN if provided
        let tenantId = null;
        if (dto.inn) {
            const tenant = await this.tenantModel.findOne({
                where: { company_inn: dto.inn },
            });
            if (tenant) {
                tenantId = tenant.id;
            }
        }
        if (!tenantId) {
            // Payment without a matched tenant — log and acknowledge to avoid retries
            this.logger.warn(`[BankWebhook] Could not match tenant for INN=${dto.inn} — logged only`);
            return { ok: true, message: 'Payment received but tenant not matched' };
        }
        // Deposit into tenant balance (performed_by = 0 = system)
        await this.balanceService.deposit(tenantId, amountRub, 0, dto.description ?? `Bank payment ${amountRub} RUB`);
        this.logger.log(`[BankWebhook] Deposited ${amountRub} RUB to tenant #${tenantId}`);
        return { ok: true, message: `Deposited ${amountRub} RUB to tenant #${tenantId}` };
    }
};
exports.BankWebhookService = BankWebhookService;
exports.BankWebhookService = BankWebhookService = BankWebhookService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(tenant_model_1.Tenant)),
    __param(1, (0, sequelize_1.InjectModel)(tenant_module_model_1.TenantModule)),
    __metadata("design:paramtypes", [Object, Object, billing_balance_service_1.BillingBalanceService,
        mailer_service_1.MailerService,
        sequelize_typescript_1.Sequelize])
], BankWebhookService);
//# sourceMappingURL=bank-webhook.service.js.map