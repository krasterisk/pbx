"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiVoiceModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const product_access_core_module_1 = require("../product-access/product-access-core.module");
const integration_credentials_module_1 = require("../integration-credentials/integration-credentials.module");
const ai_agent_model_1 = require("../ai-agents/models/ai-agent.model");
const ai_voice_models_1 = require("./ai-voice.models");
const sip_models_1 = require("./sip.models");
const ai_voice_service_1 = require("./ai-voice.service");
const sip_service_1 = require("./sip.service");
const ai_voice_resolver_1 = require("./ai-voice.resolver");
const ai_voice_jwt_controller_1 = require("./ai-voice-jwt.controller");
let AiVoiceModule = class AiVoiceModule {
};
exports.AiVoiceModule = AiVoiceModule;
exports.AiVoiceModule = AiVoiceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            integration_credentials_module_1.IntegrationCredentialsModule,
            product_access_core_module_1.ProductAccessCoreModule,
            sequelize_1.SequelizeModule.forFeature([
                ai_agent_model_1.CcAiAgent, ai_voice_models_1.AiRobotDraft, ai_voice_models_1.AiRobotVersion, ai_voice_models_1.AiRobotDeployment,
                ai_voice_models_1.AiVoiceSession, ai_voice_models_1.AiVoiceTurn, ai_voice_models_1.AiVoiceEvent, ai_voice_models_1.AiCallControlOperation, ai_voice_models_1.AiVoiceTicket,
                sip_models_1.AiSipConnection, sip_models_1.AiSipConfigRevision, sip_models_1.AiSipDidBinding, sip_models_1.AiVoiceInvocation,
            ]),
        ],
        providers: [ai_voice_service_1.AiVoiceService, sip_service_1.AiSipService, ai_voice_resolver_1.AiVoiceDeploymentResolver],
        controllers: [ai_voice_jwt_controller_1.AiVoiceJwtController],
        exports: [ai_voice_service_1.AiVoiceService, sip_service_1.AiSipService, sequelize_1.SequelizeModule],
    })
], AiVoiceModule);
//# sourceMappingURL=ai-voice.module.js.map