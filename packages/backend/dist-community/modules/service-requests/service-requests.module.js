"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceRequestsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const config_1 = require("@nestjs/config");
const service_request_model_1 = require("./service-request.model");
const cc_subject_model_1 = require("./cc-subject.model");
const cc_district_model_1 = require("./cc-district.model");
const service_requests_service_1 = require("./service-requests.service");
const service_requests_controller_1 = require("./service-requests.controller");
const service_requests_public_controller_1 = require("./service-requests-public.controller");
const sms_module_1 = require("../sms/sms.module");
const cloud_admin_module_1 = require("../cloud-admin/cloud-admin.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const service_requests_ai_adapter_1 = require("./service-requests-ai.adapter");
let ServiceRequestsModule = class ServiceRequestsModule {
};
exports.ServiceRequestsModule = ServiceRequestsModule;
exports.ServiceRequestsModule = ServiceRequestsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            sequelize_1.SequelizeModule.forFeature([service_request_model_1.ServiceRequest, cc_subject_model_1.CcSubject, cc_district_model_1.CcDistrict]),
            sms_module_1.SmsModule,
            cloud_admin_module_1.CloudAdminModule,
            ai_platform_module_1.AiPlatformModule,
        ],
        controllers: [service_requests_controller_1.ServiceRequestsController, service_requests_public_controller_1.ServiceRequestsPublicController],
        providers: [service_requests_service_1.ServiceRequestsService, service_requests_ai_adapter_1.ServiceRequestsAiAdapter],
        exports: [service_requests_service_1.ServiceRequestsService],
    })
], ServiceRequestsModule);
//# sourceMappingURL=service-requests.module.js.map