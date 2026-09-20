"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TtsEnginesModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const config_1 = require("@nestjs/config");
const tts_engine_model_1 = require("./tts-engine.model");
const tts_engines_service_1 = require("./tts-engines.service");
const tts_engines_controller_1 = require("./tts-engines.controller");
const tts_engines_public_controller_1 = require("./tts-engines-public.controller");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const tts_engines_ai_adapter_1 = require("./tts-engines-ai.adapter");
let TtsEnginesModule = class TtsEnginesModule {
};
exports.TtsEnginesModule = TtsEnginesModule;
exports.TtsEnginesModule = TtsEnginesModule = __decorate([
    (0, common_1.Module)({
        imports: [sequelize_1.SequelizeModule.forFeature([tts_engine_model_1.TtsEngine]), config_1.ConfigModule, ai_platform_module_1.AiPlatformModule],
        controllers: [tts_engines_controller_1.TtsEnginesController, tts_engines_public_controller_1.TtsEnginesPublicController],
        providers: [tts_engines_service_1.TtsEnginesService, tts_engines_ai_adapter_1.TtsEnginesAiAdapter],
        exports: [tts_engines_service_1.TtsEnginesService],
    })
], TtsEnginesModule);
//# sourceMappingURL=tts-engines.module.js.map