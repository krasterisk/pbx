"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IvrsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const config_1 = require("@nestjs/config");
const ivr_model_1 = require("./ivr.model");
const tts_engine_model_1 = require("../tts-engines/tts-engine.model");
const tts_engines_module_1 = require("../tts-engines/tts-engines.module");
const ami_module_1 = require("../ami/ami.module");
const route_references_module_1 = require("../route-references/route-references.module");
const contexts_module_1 = require("../contexts/contexts.module");
const endpoints_module_1 = require("../endpoints/endpoints.module");
const queues_module_1 = require("../queues/queues.module");
const call_groups_module_1 = require("../call-groups/call-groups.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const ivrs_controller_1 = require("./ivrs.controller");
const ivrs_internal_controller_1 = require("./ivrs-internal.controller");
const ivrs_service_1 = require("./ivrs.service");
const ivrs_ai_adapter_1 = require("./ivrs-ai.adapter");
const ivr_tts_service_1 = require("./ivr-tts.service");
const ivr_tts_google_provider_1 = require("./ivr-tts-google.provider");
const ivr_tts_custom_provider_1 = require("./ivr-tts-custom.provider");
const ivr_tts_cache_service_1 = require("./ivr-tts-cache.service");
const yandex_streaming_tts_provider_1 = require("../voice-robots/providers/yandex-streaming-tts.provider");
let IvrsModule = class IvrsModule {
};
exports.IvrsModule = IvrsModule;
exports.IvrsModule = IvrsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            sequelize_1.SequelizeModule.forFeature([ivr_model_1.Ivr, tts_engine_model_1.TtsEngine]),
            tts_engines_module_1.TtsEnginesModule,
            ami_module_1.AmiModule,
            route_references_module_1.RouteReferencesModule,
            contexts_module_1.ContextsModule,
            endpoints_module_1.EndpointsModule,
            queues_module_1.QueuesModule,
            call_groups_module_1.CallGroupsModule,
            ai_platform_module_1.AiPlatformModule,
        ],
        controllers: [ivrs_controller_1.IvrsController, ivrs_internal_controller_1.IvrsInternalController],
        providers: [
            ivrs_service_1.IvrsService,
            ivrs_ai_adapter_1.IvrsAiAdapter,
            ivr_tts_service_1.IvrTtsService,
            ivr_tts_google_provider_1.IvrTtsGoogleProvider,
            ivr_tts_custom_provider_1.IvrTtsCustomProvider,
            ivr_tts_cache_service_1.IvrTtsCacheService,
            yandex_streaming_tts_provider_1.YandexStreamingTtsProvider,
        ],
        exports: [ivrs_service_1.IvrsService, ivr_tts_service_1.IvrTtsService, ivr_tts_cache_service_1.IvrTtsCacheService],
    })
], IvrsModule);
//# sourceMappingURL=ivrs.module.js.map