"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductAccessCoreModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sequelize_1 = require("@nestjs/sequelize");
const tenant_model_1 = require("../cloud-admin/tenant.model");
const tenant_module_model_1 = require("../cloud-admin/tenant-module.model");
const action_log_model_1 = require("../logger/action-log.model");
const product_activation_model_1 = require("./product-activation.model");
const local_license_document_model_1 = require("./local-license-document.model");
const local_license_binding_model_1 = require("./local-license-binding.model");
const product_access_service_1 = require("./product-access.service");
const usage_models_1 = require("../ai-usage/usage.models");
/** Policy repository without management HTTP controllers or cloud-admin tasks. */
let ProductAccessCoreModule = class ProductAccessCoreModule {
};
exports.ProductAccessCoreModule = ProductAccessCoreModule;
exports.ProductAccessCoreModule = ProductAccessCoreModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, sequelize_1.SequelizeModule.forFeature([
                tenant_model_1.Tenant, tenant_module_model_1.TenantModule, action_log_model_1.ActionLog,
                product_activation_model_1.ProductActivation, local_license_document_model_1.LocalLicenseDocument, local_license_binding_model_1.LocalLicenseBinding,
                usage_models_1.AiSkuEntitlement, usage_models_1.AiTrialPolicySnapshot,
            ])],
        providers: [product_access_service_1.ProductAccessService],
        exports: [product_access_service_1.ProductAccessService],
    })
], ProductAccessCoreModule);
//# sourceMappingURL=product-access-core.module.js.map