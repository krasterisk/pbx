"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteTemplatesModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const route_template_model_1 = require("./route-template.model");
const route_templates_controller_1 = require("./route-templates.controller");
const route_templates_service_1 = require("./route-templates.service");
const route_templates_ai_adapter_1 = require("./route-templates-ai.adapter");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const queue_model_1 = require("../queues/queue.model");
const call_group_model_1 = require("../call-groups/call-group.model");
const ivr_model_1 = require("../ivrs/ivr.model");
const ps_endpoint_model_1 = require("../endpoints/ps-endpoint.model");
const prompt_model_1 = require("../prompts/prompt.model");
const directory_model_1 = require("../directories/directory.model");
let RouteTemplatesModule = class RouteTemplatesModule {
};
exports.RouteTemplatesModule = RouteTemplatesModule;
exports.RouteTemplatesModule = RouteTemplatesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([
                route_template_model_1.RouteTemplate,
                queue_model_1.Queue,
                call_group_model_1.CallGroup,
                ivr_model_1.Ivr,
                ps_endpoint_model_1.PsEndpoint,
                prompt_model_1.Prompt,
                directory_model_1.Directory,
            ]),
            ai_platform_module_1.AiPlatformModule,
        ],
        controllers: [route_templates_controller_1.RouteTemplatesController],
        providers: [route_templates_service_1.RouteTemplatesService, route_templates_ai_adapter_1.RouteTemplatesAiAdapter],
        exports: [route_templates_service_1.RouteTemplatesService],
    })
], RouteTemplatesModule);
//# sourceMappingURL=route-templates.module.js.map