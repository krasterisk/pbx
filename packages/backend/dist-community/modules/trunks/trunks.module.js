"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrunksModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ps_endpoint_model_1 = require("../endpoints/ps-endpoint.model");
const ps_auth_model_1 = require("../endpoints/ps-auth.model");
const ps_aor_model_1 = require("../endpoints/ps-aor.model");
const ps_registration_model_1 = require("./ps-registration.model");
const ps_endpoint_id_ip_model_1 = require("./ps-endpoint-id-ip.model");
const trunks_service_1 = require("./trunks.service");
const trunks_controller_1 = require("./trunks.controller");
const trunks_ai_adapter_1 = require("./trunks-ai.adapter");
const ami_module_1 = require("../ami/ami.module");
const logger_module_1 = require("../logger/logger.module");
const routes_module_1 = require("../routes/routes.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
let TrunksModule = class TrunksModule {
};
exports.TrunksModule = TrunksModule;
exports.TrunksModule = TrunksModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([
                ps_endpoint_model_1.PsEndpoint, ps_auth_model_1.PsAuth, ps_aor_model_1.PsAor,
                ps_registration_model_1.PsRegistration, ps_endpoint_id_ip_model_1.PsEndpointIdIp,
            ]),
            ami_module_1.AmiModule,
            logger_module_1.LoggerModule,
            (0, common_1.forwardRef)(() => routes_module_1.RoutesModule),
            ai_platform_module_1.AiPlatformModule,
        ],
        providers: [trunks_service_1.TrunksService, trunks_ai_adapter_1.TrunksAiAdapter],
        controllers: [trunks_controller_1.TrunksController],
        exports: [trunks_service_1.TrunksService],
    })
], TrunksModule);
//# sourceMappingURL=trunks.module.js.map