"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const context_model_1 = require("./context.model");
const contexts_service_1 = require("./contexts.service");
const contexts_controller_1 = require("./contexts.controller");
const contexts_ai_adapter_1 = require("./contexts-ai.adapter");
const ami_module_1 = require("../ami/ami.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
let ContextsModule = class ContextsModule {
};
exports.ContextsModule = ContextsModule;
exports.ContextsModule = ContextsModule = __decorate([
    (0, common_1.Module)({
        imports: [sequelize_1.SequelizeModule.forFeature([context_model_1.Context]), (0, common_1.forwardRef)(() => ami_module_1.AmiModule), ai_platform_module_1.AiPlatformModule],
        providers: [contexts_service_1.ContextsService, contexts_ai_adapter_1.ContextsAiAdapter],
        controllers: [contexts_controller_1.ContextsController],
        exports: [contexts_service_1.ContextsService],
    })
], ContextsModule);
//# sourceMappingURL=contexts.module.js.map