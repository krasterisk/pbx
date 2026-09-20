"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeGroupsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const time_group_model_1 = require("./time-group.model");
const time_groups_controller_1 = require("./time-groups.controller");
const time_groups_service_1 = require("./time-groups.service");
const time_groups_ai_adapter_1 = require("./time-groups-ai.adapter");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const tenant_settings_module_1 = require("../tenant-settings/tenant-settings.module");
let TimeGroupsModule = class TimeGroupsModule {
};
exports.TimeGroupsModule = TimeGroupsModule;
exports.TimeGroupsModule = TimeGroupsModule = __decorate([
    (0, common_1.Module)({
        imports: [sequelize_1.SequelizeModule.forFeature([time_group_model_1.TimeGroup]), ai_platform_module_1.AiPlatformModule, tenant_settings_module_1.TenantSettingsModule],
        controllers: [time_groups_controller_1.TimeGroupsController],
        providers: [time_groups_service_1.TimeGroupsService, time_groups_ai_adapter_1.TimeGroupsAiAdapter],
        exports: [time_groups_service_1.TimeGroupsService],
    })
], TimeGroupsModule);
//# sourceMappingURL=time-groups.module.js.map