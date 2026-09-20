"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemSettingsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const system_settings_service_1 = require("./system-settings.service");
const system_settings_controller_1 = require("./system-settings.controller");
const dialplan_subroutines_service_1 = require("./dialplan-subroutines.service");
const system_settings_ai_adapter_1 = require("./system-settings-ai.adapter");
const system_setting_model_1 = require("./system-setting.model");
const ami_module_1 = require("../ami/ami.module");
const routes_module_1 = require("../routes/routes.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
let SystemSettingsModule = class SystemSettingsModule {
};
exports.SystemSettingsModule = SystemSettingsModule;
exports.SystemSettingsModule = SystemSettingsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([system_setting_model_1.SystemSetting]),
            ami_module_1.AmiModule,
            routes_module_1.RoutesModule,
            ai_platform_module_1.AiPlatformModule,
        ],
        providers: [system_settings_service_1.SystemSettingsService, dialplan_subroutines_service_1.DialplanSubroutinesService, system_settings_ai_adapter_1.SystemSettingsAiAdapter],
        controllers: [system_settings_controller_1.SystemSettingsController],
        exports: [system_settings_service_1.SystemSettingsService, dialplan_subroutines_service_1.DialplanSubroutinesService],
    })
], SystemSettingsModule);
//# sourceMappingURL=system-settings.module.js.map