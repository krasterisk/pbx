"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiUsageModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const usage_models_1 = require("./usage.models");
/** Usage journal, SKU catalog and settlement. Live BillingBalanceService.charge is opt-in via COM2 flags, not registered here. */
let AiUsageModule = class AiUsageModule {
};
exports.AiUsageModule = AiUsageModule;
exports.AiUsageModule = AiUsageModule = __decorate([
    (0, common_1.Module)({
        imports: [sequelize_1.SequelizeModule.forFeature([
                usage_models_1.AiQuotaCounter, usage_models_1.AiPriceRevision, usage_models_1.AiUsageReservation, usage_models_1.AiUsageEvent, usage_models_1.AiUsageLedger,
                usage_models_1.AiTrialPolicySnapshot, usage_models_1.AiSkuRevision, usage_models_1.AiSkuOffer, usage_models_1.AiSkuEntitlement,
            ])],
        exports: [sequelize_1.SequelizeModule],
    })
], AiUsageModule);
//# sourceMappingURL=ai-usage.module.js.map