"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EndpointsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ps_endpoint_model_1 = require("./ps-endpoint.model");
const ps_auth_model_1 = require("./ps-auth.model");
const ps_aor_model_1 = require("./ps-aor.model");
const ps_contact_model_1 = require("./ps-contact.model");
const pickup_group_model_1 = require("./pickup-group.model");
const provision_template_model_1 = require("./provision-template.model");
const pickup_groups_service_1 = require("./pickup-groups.service");
const pickup_groups_controller_1 = require("./pickup-groups.controller");
const provision_templates_service_1 = require("./provision-templates.service");
const provision_templates_controller_1 = require("./provision-templates.controller");
const provision_controller_1 = require("./provision.controller");
const endpoints_service_1 = require("./endpoints.service");
const endpoints_controller_1 = require("./endpoints.controller");
const endpoints_ai_adapter_1 = require("./endpoints-ai.adapter");
const contexts_module_1 = require("../contexts/contexts.module");
const logger_module_1 = require("../logger/logger.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
let EndpointsModule = class EndpointsModule {
};
exports.EndpointsModule = EndpointsModule;
exports.EndpointsModule = EndpointsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([
                ps_endpoint_model_1.PsEndpoint, ps_auth_model_1.PsAuth, ps_aor_model_1.PsAor, ps_contact_model_1.PsContact,
                pickup_group_model_1.PickupGroup, provision_template_model_1.ProvisionTemplate
            ]),
            contexts_module_1.ContextsModule,
            logger_module_1.LoggerModule,
            ai_platform_module_1.AiPlatformModule,
        ],
        providers: [endpoints_service_1.EndpointsService, pickup_groups_service_1.PickupGroupsService, provision_templates_service_1.ProvisionTemplatesService, endpoints_ai_adapter_1.EndpointsAiAdapter],
        controllers: [endpoints_controller_1.EndpointsController, pickup_groups_controller_1.PickupGroupsController, provision_templates_controller_1.ProvisionTemplatesController, provision_controller_1.ProvisionController],
        exports: [endpoints_service_1.EndpointsService],
    })
], EndpointsModule);
//# sourceMappingURL=endpoints.module.js.map