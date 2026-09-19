"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationCredentialsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const sequelize_1 = require("@nestjs/sequelize");
const user_model_1 = require("../users/user.model");
const tenant_model_1 = require("../cloud-admin/tenant.model");
const product_access_core_module_1 = require("../product-access/product-access-core.module");
const integration_credential_models_1 = require("./integration-credential.models");
const tenant_context_resolver_1 = require("./tenant-context.resolver");
const tenant_context_guard_1 = require("./tenant-context.guard");
const integration_credentials_service_1 = require("./integration-credentials.service");
const integration_key_rate_limiter_1 = require("./integration-key-rate-limiter");
const integration_credentials_controller_1 = require("./integration-credentials.controller");
const product_resource_authorization_1 = require("./product-resource.authorization");
let IntegrationCredentialsModule = class IntegrationCredentialsModule {
};
exports.IntegrationCredentialsModule = IntegrationCredentialsModule;
exports.IntegrationCredentialsModule = IntegrationCredentialsModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, jwt_1.JwtModule.register({}), product_access_core_module_1.ProductAccessCoreModule, sequelize_1.SequelizeModule.forFeature([
                user_model_1.User, tenant_model_1.Tenant, integration_credential_models_1.IntegrationPrincipal, integration_credential_models_1.IntegrationCredential,
                integration_credential_models_1.IntegrationGrant, integration_credential_models_1.IntegrationAudit, integration_credential_models_1.IntegrationCommand, integration_credential_models_1.IntegrationAuthLimit,
            ])],
        providers: [
            tenant_context_resolver_1.TenantContextResolver, tenant_context_guard_1.TenantContextGuard, product_resource_authorization_1.ProductResourceAuthorization,
            integration_credentials_service_1.IntegrationCredentialsService,
            integration_key_rate_limiter_1.IntegrationKeyRateLimiter,
            { provide: product_resource_authorization_1.PRODUCT_RESOURCE_RESOLVERS, useValue: [] },
        ],
        controllers: [integration_credentials_controller_1.IntegrationCredentialsController],
        exports: [tenant_context_resolver_1.TenantContextResolver, tenant_context_guard_1.TenantContextGuard, integration_key_rate_limiter_1.IntegrationKeyRateLimiter,
            product_resource_authorization_1.ProductResourceAuthorization, integration_credentials_service_1.IntegrationCredentialsService],
    })
], IntegrationCredentialsModule);
//# sourceMappingURL=integration-credentials.module.js.map