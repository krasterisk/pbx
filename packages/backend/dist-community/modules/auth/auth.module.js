"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const sequelize_1 = require("@nestjs/sequelize");
const throttler_1 = require("@nestjs/throttler");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const jwt_strategy_1 = require("./jwt.strategy");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const roles_guard_1 = require("./roles.guard");
const superadmin_guard_1 = require("./superadmin.guard");
const user_session_model_1 = require("./user-session.model");
const users_module_1 = require("../users/users.module");
const logger_module_1 = require("../logger/logger.module");
const mailer_module_1 = require("../mailer/mailer.module");
const jwt_secret_1 = require("./jwt-secret");
const tenant_registration_service_1 = require("./tenant-registration.service");
const user_model_1 = require("../users/user.model");
const tenant_model_1 = require("../cloud-admin/tenant.model");
const context_model_1 = require("../contexts/context.model");
const tenant_identity_module_1 = require("../tenant-identity/tenant-identity.module");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([user_session_model_1.UserSession, user_model_1.User, tenant_model_1.Tenant, context_model_1.Context]),
            tenant_identity_module_1.TenantIdentityModule,
            users_module_1.UsersModule,
            logger_module_1.LoggerModule,
            mailer_module_1.MailerModule,
            // Rate limiting — shared store (in-memory by default, swap to Redis in production)
            throttler_1.ThrottlerModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: (config) => ([{
                        ttl: config.get('THROTTLE_TTL', 60_000),
                        limit: config.get('THROTTLE_LIMIT', 20),
                    }]),
                inject: [config_1.ConfigService],
            }),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: (config) => ({
                    secret: (0, jwt_secret_1.requireJwtSecret)(config),
                    signOptions: {
                        expiresIn: config.get('JWT_EXPIRES_IN', '2h'),
                        issuer: 'krasterisk-v4',
                        audience: 'krasterisk-v4-client',
                    },
                }),
                inject: [config_1.ConfigService],
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, tenant_registration_service_1.TenantRegistrationService, jwt_strategy_1.JwtStrategy, jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, superadmin_guard_1.SuperAdminGuard],
        exports: [auth_service_1.AuthService, jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, superadmin_guard_1.SuperAdminGuard],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map