"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudAdminModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const tenant_model_1 = require("./tenant.model");
const module_registry_model_1 = require("./module-registry.model");
const tenant_module_model_1 = require("./tenant-module.model");
const hub_module_model_1 = require("./models/hub-module.model");
const hub_module_page_model_1 = require("./models/hub-module-page.model");
const role_start_model_1 = require("./models/role-start.model");
const device_token_model_1 = require("./models/device-token.model");
const user_model_1 = require("../users/user.model");
const tenants_service_1 = require("./tenants.service");
const tenants_controller_1 = require("./tenants.controller");
const tenant_modules_controller_1 = require("./tenant-modules.controller");
const marketplace_controller_1 = require("./marketplace.controller");
const device_token_controller_1 = require("./device-token.controller");
const hub_modules_controller_1 = require("./hub-modules.controller");
const role_start_controller_1 = require("./role-start.controller");
const modules_registry_service_1 = require("./modules-registry.service");
const purchase_module_service_1 = require("./purchase-module.service");
const role_start_service_1 = require("./role-start.service");
const device_token_service_1 = require("./device-token.service");
const module_access_guard_1 = require("./module-access.guard");
const users_module_1 = require("../users/users.module");
const logger_module_1 = require("../logger/logger.module");
const mailer_module_1 = require("../mailer/mailer.module");
const billing_module_1 = require("./billing/billing.module");
const cloud_setting_model_1 = require("./cloud-setting.model");
const cloud_settings_service_1 = require("./cloud-settings.service");
const cloud_settings_controller_1 = require("./cloud-settings.controller");
const product_access_module_1 = require("../product-access/product-access.module");
const tenant_identity_module_1 = require("../tenant-identity/tenant-identity.module");
let CloudAdminModule = class CloudAdminModule {
};
exports.CloudAdminModule = CloudAdminModule;
exports.CloudAdminModule = CloudAdminModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([
                tenant_model_1.Tenant, module_registry_model_1.ModuleRegistry, tenant_module_model_1.TenantModule, user_model_1.User, cloud_setting_model_1.CloudSetting,
                hub_module_model_1.HubModule, hub_module_page_model_1.HubModulePage,
                role_start_model_1.RoleStartDefault, role_start_model_1.TenantRoleStart,
                device_token_model_1.DeviceToken,
            ]),
            users_module_1.UsersModule,
            logger_module_1.LoggerModule,
            mailer_module_1.MailerModule,
            // JwtModule needed for impersonate()
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: (config) => ({
                    secret: config.get('JWT_SECRET', 'krasterisk-v4-secret'),
                    signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '2h') },
                }),
                inject: [config_1.ConfigService],
            }),
            billing_module_1.BillingModule,
            product_access_module_1.ProductAccessModule,
            tenant_identity_module_1.TenantIdentityModule,
        ],
        providers: [
            tenants_service_1.TenantsService,
            modules_registry_service_1.ModulesRegistryService,
            purchase_module_service_1.PurchaseModuleService,
            role_start_service_1.RoleStartService,
            device_token_service_1.DeviceTokenService,
            module_access_guard_1.ModuleAccessGuard,
            cloud_settings_service_1.CloudSettingsService,
        ],
        controllers: [
            tenants_controller_1.TenantsController,
            tenant_modules_controller_1.TenantModulesController,
            tenant_modules_controller_1.AiProductCatalogMaintenanceController,
            tenant_modules_controller_1.MarketplaceController,
            marketplace_controller_1.MarketplacePurchaseController,
            device_token_controller_1.DeviceTokenController,
            hub_modules_controller_1.HubModulesController,
            role_start_controller_1.PlatformRoleStartController,
            role_start_controller_1.MarketplaceRoleStartController,
            cloud_settings_controller_1.CloudSettingsController,
        ],
        exports: [
            tenants_service_1.TenantsService,
            modules_registry_service_1.ModulesRegistryService,
            purchase_module_service_1.PurchaseModuleService,
            role_start_service_1.RoleStartService,
            device_token_service_1.DeviceTokenService,
            module_access_guard_1.ModuleAccessGuard,
            billing_module_1.BillingModule,
            cloud_settings_service_1.CloudSettingsService,
        ],
    })
], CloudAdminModule);
//# sourceMappingURL=cloud-admin.module.js.map