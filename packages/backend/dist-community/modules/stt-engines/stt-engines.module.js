"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SttEnginesModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const config_1 = require("@nestjs/config");
const stt_engine_model_1 = require("./stt-engine.model");
const stt_engines_service_1 = require("./stt-engines.service");
const stt_engines_controller_1 = require("./stt-engines.controller");
const stt_engines_public_controller_1 = require("./stt-engines-public.controller");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const stt_engines_ai_adapter_1 = require("./stt-engines-ai.adapter");
let SttEnginesModule = class SttEnginesModule {
};
exports.SttEnginesModule = SttEnginesModule;
exports.SttEnginesModule = SttEnginesModule = __decorate([
    (0, common_1.Module)({
        imports: [sequelize_1.SequelizeModule.forFeature([stt_engine_model_1.SttEngine]), config_1.ConfigModule, ai_platform_module_1.AiPlatformModule],
        controllers: [stt_engines_controller_1.SttEnginesController, stt_engines_public_controller_1.SttEnginesPublicController],
        providers: [stt_engines_service_1.SttEnginesService, stt_engines_ai_adapter_1.SttEnginesAiAdapter],
        exports: [stt_engines_service_1.SttEnginesService],
    })
], SttEnginesModule);
//# sourceMappingURL=stt-engines.module.js.map