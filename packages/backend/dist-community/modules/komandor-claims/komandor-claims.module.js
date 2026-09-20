"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KomandorClaimsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const config_1 = require("@nestjs/config");
const komandor_claim_model_1 = require("./komandor-claim.model");
const komandor_store_model_1 = require("./komandor-store.model");
const komandor_dict_model_1 = require("./komandor-dict.model");
const komandor_claims_service_1 = require("./komandor-claims.service");
const komandor_claims_controller_1 = require("./komandor-claims.controller");
const komandor_claims_public_controller_1 = require("./komandor-claims-public.controller");
const sms_module_1 = require("../sms/sms.module");
const mailer_module_1 = require("../mailer/mailer.module");
const cloud_admin_module_1 = require("../cloud-admin/cloud-admin.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const komandor_claims_ai_adapter_1 = require("./komandor-claims-ai.adapter");
let KomandorClaimsModule = class KomandorClaimsModule {
};
exports.KomandorClaimsModule = KomandorClaimsModule;
exports.KomandorClaimsModule = KomandorClaimsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            sequelize_1.SequelizeModule.forFeature([komandor_claim_model_1.KomandorClaim, komandor_store_model_1.KomandorStore, komandor_dict_model_1.KomandorDict]),
            sms_module_1.SmsModule,
            mailer_module_1.MailerModule,
            cloud_admin_module_1.CloudAdminModule,
            ai_platform_module_1.AiPlatformModule,
        ],
        controllers: [komandor_claims_controller_1.KomandorClaimsController, komandor_claims_public_controller_1.KomandorClaimsPublicController],
        providers: [komandor_claims_service_1.KomandorClaimsService, komandor_claims_ai_adapter_1.KomandorClaimsAiAdapter],
        exports: [komandor_claims_service_1.KomandorClaimsService],
    })
], KomandorClaimsModule);
//# sourceMappingURL=komandor-claims.module.js.map