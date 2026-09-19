"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandaloneIdentityModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const sequelize_1 = require("@nestjs/sequelize");
const throttler_1 = require("@nestjs/throttler");
const user_model_1 = require("../users/user.model");
const jwt_secret_1 = require("../auth/jwt-secret");
const integration_credentials_module_1 = require("../integration-credentials/integration-credentials.module");
const product_access_core_module_1 = require("../product-access/product-access-core.module");
const standalone_capabilities_controller_1 = require("./standalone-capabilities.controller");
const standalone_capabilities_service_1 = require("./standalone-capabilities.service");
const standalone_login_controller_1 = require("./standalone-login.controller");
const standalone_login_service_1 = require("./standalone-login.service");
let StandaloneIdentityModule = class StandaloneIdentityModule {
};
exports.StandaloneIdentityModule = StandaloneIdentityModule;
exports.StandaloneIdentityModule = StandaloneIdentityModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([user_model_1.User]), integration_credentials_module_1.IntegrationCredentialsModule, product_access_core_module_1.ProductAccessCoreModule,
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule], inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: (0, jwt_secret_1.requireJwtSecret)(config),
                    signOptions: { expiresIn: '2h', issuer: 'krasterisk-v4', audience: 'krasterisk-v4-client' },
                }),
            }),
        ],
        controllers: [standalone_login_controller_1.StandaloneLoginController, standalone_capabilities_controller_1.StandaloneCapabilitiesController],
        providers: [standalone_login_service_1.StandaloneLoginService, standalone_capabilities_service_1.StandaloneCapabilitiesService],
    })
], StandaloneIdentityModule);
//# sourceMappingURL=standalone-identity.module.js.map