"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const schedule_1 = require("@nestjs/schedule");
const axios_1 = require("@nestjs/axios");
const billing_balance_model_1 = require("./models/billing-balance.model");
const billing_transaction_model_1 = require("./models/billing-transaction.model");
const billing_balance_service_1 = require("./billing-balance.service");
const billing_scheduler_service_1 = require("./billing-scheduler.service");
const billing_controller_1 = require("./billing.controller");
const bank_webhook_controller_1 = require("./bank-webhook.controller");
const bank_webhook_service_1 = require("./bank-webhook.service");
const tenant_module_model_1 = require("../tenant-module.model");
const module_registry_model_1 = require("../module-registry.model");
const tenant_model_1 = require("../tenant.model");
const cloud_settings_service_1 = require("../cloud-settings.service");
const cloud_setting_model_1 = require("../cloud-setting.model");
// ── Accounting Providers ──────────────────────────────────────────────────────
const accounting_provider_factory_1 = require("./accounting/accounting-provider.factory");
const sbis_accounting_provider_1 = require("./accounting/providers/sbis-accounting.provider");
const null_accounting_provider_1 = require("./accounting/providers/null-accounting.provider");
const mailer_module_1 = require("../../mailer/mailer.module");
let BillingModule = class BillingModule {
};
exports.BillingModule = BillingModule;
exports.BillingModule = BillingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            axios_1.HttpModule.register({ timeout: 15_000, maxRedirects: 3 }),
            mailer_module_1.MailerModule,
            sequelize_1.SequelizeModule.forFeature([
                billing_balance_model_1.BillingBalance, billing_transaction_model_1.BillingTransaction,
                tenant_module_model_1.TenantModule, module_registry_model_1.ModuleRegistry, tenant_model_1.Tenant,
                cloud_setting_model_1.CloudSetting,
            ]),
        ],
        providers: [
            billing_balance_service_1.BillingBalanceService,
            billing_scheduler_service_1.BillingSchedulerService,
            bank_webhook_service_1.BankWebhookService,
            cloud_settings_service_1.CloudSettingsService,
            // Accounting strategy pattern
            sbis_accounting_provider_1.SbisAccountingProvider,
            null_accounting_provider_1.NullAccountingProvider,
            accounting_provider_factory_1.AccountingProviderFactory,
        ],
        controllers: [
            billing_controller_1.BillingAdminController,
            billing_controller_1.BillingTenantController,
            bank_webhook_controller_1.BankWebhookController,
        ],
        exports: [billing_balance_service_1.BillingBalanceService, accounting_provider_factory_1.AccountingProviderFactory],
    })
], BillingModule);
//# sourceMappingURL=billing.module.js.map