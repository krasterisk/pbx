"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const users_service_1 = require("./users.service");
const users_controller_1 = require("./users.controller");
const users_ai_adapter_1 = require("./users-ai.adapter");
const user_model_1 = require("./user.model");
const logger_module_1 = require("../logger/logger.module");
const system_settings_module_1 = require("../system-settings/system-settings.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
let UsersModule = class UsersModule {
};
exports.UsersModule = UsersModule;
exports.UsersModule = UsersModule = __decorate([
    (0, common_1.Module)({
        imports: [sequelize_1.SequelizeModule.forFeature([user_model_1.User]), logger_module_1.LoggerModule, system_settings_module_1.SystemSettingsModule, ai_platform_module_1.AiPlatformModule],
        providers: [users_service_1.UsersService, users_ai_adapter_1.UsersAiAdapter],
        controllers: [users_controller_1.UsersController],
        exports: [users_service_1.UsersService],
    })
], UsersModule);
//# sourceMappingURL=users.module.js.map