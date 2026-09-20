"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiPlatformModule = void 0;
const common_1 = require("@nestjs/common");
const agent_skill_registry_service_1 = require("./agent-skill-registry.service");
const ai_adapter_registry_service_1 = require("./ai-adapter-registry.service");
/**
 * AiPlatformModule — lightweight, domain-agnostic AI adapter registry (D-14).
 *
 * @Global(): once imported by any module in the app (currently DirectoriesModule,
 * McpModule, AiChatModule), AiAdapterRegistryService is injectable everywhere
 * without further imports. This module never imports domain modules — domains
 * depend on it, not the other way around, so there is no cycle risk.
 */
let AiPlatformModule = class AiPlatformModule {
};
exports.AiPlatformModule = AiPlatformModule;
exports.AiPlatformModule = AiPlatformModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [ai_adapter_registry_service_1.AiAdapterRegistryService, agent_skill_registry_service_1.AgentSkillRegistryService],
        exports: [ai_adapter_registry_service_1.AiAdapterRegistryService, agent_skill_registry_service_1.AgentSkillRegistryService],
    })
], AiPlatformModule);
//# sourceMappingURL=ai-platform.module.js.map