"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceRobotsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const config_1 = require("@nestjs/config");
const voice_robot_model_1 = require("./voice-robot.model");
const keyword_group_model_1 = require("./keyword-group.model");
const keyword_model_1 = require("./keyword.model");
const voice_robot_log_model_1 = require("./voice-robot-log.model");
const voice_robot_cdr_model_1 = require("./voice-robot-cdr.model");
const data_list_model_1 = require("./data-list.model");
const voice_robots_controller_1 = require("./voice-robots.controller");
const voice_robots_public_controller_1 = require("./voice-robots-public.controller");
const voice_robots_public_key_guard_1 = require("./voice-robots-public-key.guard");
const voice_robots_service_1 = require("./voice-robots.service");
const silero_vad_provider_1 = require("./services/silero-vad.provider");
const streaming_stt_service_1 = require("./services/streaming-stt.service");
const keyword_matcher_service_1 = require("./services/keyword-matcher.service");
const rtp_udp_server_service_1 = require("./services/rtp-udp-server.service");
const stream_audio_service_1 = require("./services/stream-audio.service");
const audio_service_1 = require("./services/audio.service");
const semantic_router_service_1 = require("./services/semantic-router.service");
const slot_extractor_service_1 = require("./services/slot-extractor.service");
const data_list_search_service_1 = require("./services/data-list-search.service");
const tts_cache_service_1 = require("./services/tts-cache.service");
const ari_module_1 = require("../ari/ari.module");
const cloud_admin_module_1 = require("../cloud-admin/cloud-admin.module");
const route_references_module_1 = require("../route-references/route-references.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const tts_engines_module_1 = require("../tts-engines/tts-engines.module");
const stt_engines_module_1 = require("../stt-engines/stt-engines.module");
const voice_robots_ai_adapter_1 = require("./voice-robots-ai.adapter");
// STT/TTS Providers (Phase 1)
const yandex_streaming_stt_provider_1 = require("./providers/yandex-streaming-stt.provider");
const yandex_streaming_tts_provider_1 = require("./providers/yandex-streaming-tts.provider");
const custom_http_stt_provider_1 = require("./providers/custom-http-stt.provider");
const provider_factory_1 = require("./providers/provider-factory");
// STT/TTS Engine models (for provider factory to resolve engine config)
const stt_engine_model_1 = require("../stt-engines/stt-engine.model");
const tts_engine_model_1 = require("../tts-engines/tts-engine.model");
let VoiceRobotsModule = class VoiceRobotsModule {
};
exports.VoiceRobotsModule = VoiceRobotsModule;
exports.VoiceRobotsModule = VoiceRobotsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            sequelize_1.SequelizeModule.forFeature([
                voice_robot_model_1.VoiceRobot,
                keyword_group_model_1.VoiceRobotKeywordGroup,
                keyword_model_1.VoiceRobotKeyword,
                voice_robot_log_model_1.VoiceRobotLog,
                voice_robot_cdr_model_1.VoiceRobotCdr,
                data_list_model_1.VoiceRobotDataList,
                stt_engine_model_1.SttEngine,
                tts_engine_model_1.TtsEngine,
            ]),
            ari_module_1.AriModule,
            cloud_admin_module_1.CloudAdminModule,
            route_references_module_1.RouteReferencesModule,
            ai_platform_module_1.AiPlatformModule,
            tts_engines_module_1.TtsEnginesModule,
            stt_engines_module_1.SttEnginesModule,
        ],
        controllers: [voice_robots_controller_1.VoiceRobotsController, voice_robots_public_controller_1.VoiceRobotsPublicController],
        providers: [
            voice_robots_public_key_guard_1.VoiceRobotsPublicKeyGuard,
            voice_robots_service_1.VoiceRobotsService,
            // Audio pipeline
            silero_vad_provider_1.SileroVadProvider,
            rtp_udp_server_service_1.RtpUdpServerService,
            stream_audio_service_1.StreamAudioService,
            audio_service_1.AudioService,
            // Legacy STT (fallback stub — will be replaced by provider factory)
            streaming_stt_service_1.StreamingSttService,
            // Keyword matching
            keyword_matcher_service_1.KeywordMatcherService,
            semantic_router_service_1.SemanticRouterService,
            slot_extractor_service_1.SlotExtractorService,
            data_list_search_service_1.DataListSearchService,
            // STT Providers
            yandex_streaming_stt_provider_1.YandexStreamingSttProvider,
            custom_http_stt_provider_1.CustomHttpSttProvider,
            provider_factory_1.SttProviderFactory,
            // TTS Providers
            yandex_streaming_tts_provider_1.YandexStreamingTtsProvider,
            provider_factory_1.TtsProviderFactory,
            tts_cache_service_1.TtsCacheService,
            voice_robots_ai_adapter_1.VoiceRobotsAiAdapter,
        ],
        exports: [voice_robots_service_1.VoiceRobotsService, rtp_udp_server_service_1.RtpUdpServerService, provider_factory_1.SttProviderFactory],
    })
], VoiceRobotsModule);
//# sourceMappingURL=voice-robots.module.js.map