"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiConnectivityModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ai_provider_model_1 = require("./ai-provider.model");
const ai_providers_service_1 = require("./ai-providers.service");
/** Neutral provider store; no robot CRUD, PBX listener or voicemail dependency. */
let AiConnectivityModule = class AiConnectivityModule {
};
exports.AiConnectivityModule = AiConnectivityModule;
exports.AiConnectivityModule = AiConnectivityModule = __decorate([
    (0, common_1.Module)({
        imports: [sequelize_1.SequelizeModule.forFeature([ai_provider_model_1.CcAiProvider])],
        providers: [ai_providers_service_1.AiProvidersService],
        exports: [ai_providers_service_1.AiProvidersService],
    })
], AiConnectivityModule);
//# sourceMappingURL=ai-connectivity.module.js.map