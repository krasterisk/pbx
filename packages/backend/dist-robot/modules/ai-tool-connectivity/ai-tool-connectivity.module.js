"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiToolConnectivityModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const product_access_core_module_1 = require("../product-access/product-access-core.module");
const integration_credentials_module_1 = require("../integration-credentials/integration-credentials.module");
const tool_models_1 = require("./tool.models");
const ai_tool_connectivity_service_1 = require("./ai-tool-connectivity.service");
const ai_tool_connectivity_jwt_controller_1 = require("./ai-tool-connectivity-jwt.controller");
let AiToolConnectivityModule = class AiToolConnectivityModule {
};
exports.AiToolConnectivityModule = AiToolConnectivityModule;
exports.AiToolConnectivityModule = AiToolConnectivityModule = __decorate([
    (0, common_1.Module)({
        imports: [
            integration_credentials_module_1.IntegrationCredentialsModule,
            product_access_core_module_1.ProductAccessCoreModule,
            sequelize_1.SequelizeModule.forFeature([tool_models_1.AiBusinessConnection, tool_models_1.AiToolRevision, tool_models_1.AiRobotToolBinding]),
        ],
        providers: [ai_tool_connectivity_service_1.AiToolConnectivityService],
        controllers: [ai_tool_connectivity_jwt_controller_1.AiToolConnectivityJwtController],
        exports: [ai_tool_connectivity_service_1.AiToolConnectivityService, sequelize_1.SequelizeModule],
    })
], AiToolConnectivityModule);
//# sourceMappingURL=ai-tool-connectivity.module.js.map