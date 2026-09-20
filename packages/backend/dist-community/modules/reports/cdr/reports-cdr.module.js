"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsCdrModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const cdr_model_1 = require("./cdr.model");
const cdr_service_1 = require("./cdr.service");
const cdr_controller_1 = require("./cdr.controller");
const cdr_public_controller_1 = require("./cdr-public.controller");
const system_settings_module_1 = require("../../system-settings/system-settings.module");
const cloud_admin_module_1 = require("../../cloud-admin/cloud-admin.module");
const ps_endpoint_model_1 = require("../../endpoints/ps-endpoint.model");
const user_model_1 = require("../../users/user.model");
const number_list_model_1 = require("../../numbers/number-list.model");
const ai_platform_module_1 = require("../../ai-platform/ai-platform.module");
const reports_ai_adapter_1 = require("../reports-ai.adapter");
let ReportsCdrModule = class ReportsCdrModule {
};
exports.ReportsCdrModule = ReportsCdrModule;
exports.ReportsCdrModule = ReportsCdrModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([cdr_model_1.Cdr, ps_endpoint_model_1.PsEndpoint, user_model_1.User, number_list_model_1.NumberList]),
            system_settings_module_1.SystemSettingsModule,
            cloud_admin_module_1.CloudAdminModule,
            ai_platform_module_1.AiPlatformModule,
        ],
        controllers: [cdr_controller_1.CdrController, cdr_public_controller_1.CdrPublicController],
        providers: [cdr_service_1.CdrService, reports_ai_adapter_1.ReportsAiAdapter],
        exports: [cdr_service_1.CdrService],
    })
], ReportsCdrModule);
//# sourceMappingURL=reports-cdr.module.js.map