"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const prompt_model_1 = require("./prompt.model");
const prompts_service_1 = require("./prompts.service");
const prompts_controller_1 = require("./prompts.controller");
const ami_module_1 = require("../ami/ami.module");
const ivrs_module_1 = require("../ivrs/ivrs.module");
const system_settings_module_1 = require("../system-settings/system-settings.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const prompts_ai_adapter_1 = require("./prompts-ai.adapter");
let PromptsModule = class PromptsModule {
};
exports.PromptsModule = PromptsModule;
exports.PromptsModule = PromptsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([prompt_model_1.Prompt]),
            ami_module_1.AmiModule,
            ivrs_module_1.IvrsModule,
            system_settings_module_1.SystemSettingsModule,
            ai_platform_module_1.AiPlatformModule,
        ],
        controllers: [prompts_controller_1.PromptsController],
        providers: [prompts_service_1.PromptsService, prompts_ai_adapter_1.PromptsAiAdapter],
        exports: [prompts_service_1.PromptsService],
    })
], PromptsModule);
//# sourceMappingURL=prompts.module.js.map