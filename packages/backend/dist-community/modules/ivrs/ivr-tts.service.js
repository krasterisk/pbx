"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var IvrTtsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IvrTtsService = void 0;
const common_1 = require("@nestjs/common");
const tts_engines_service_1 = require("../tts-engines/tts-engines.service");
const yandex_streaming_tts_provider_1 = require("../voice-robots/providers/yandex-streaming-tts.provider");
const ivr_tts_google_provider_1 = require("./ivr-tts-google.provider");
const ivr_tts_custom_provider_1 = require("./ivr-tts-custom.provider");
const ivr_tts_settings_util_1 = require("./ivr-tts-settings.util");
const ivr_pcm_wav_util_1 = require("./ivr-pcm-wav.util");
let IvrTtsService = IvrTtsService_1 = class IvrTtsService {
    ttsEnginesService;
    yandexTts;
    googleTts;
    customTts;
    logger = new common_1.Logger(IvrTtsService_1.name);
    constructor(ttsEnginesService, yandexTts, googleTts, customTts) {
        this.ttsEnginesService = ttsEnginesService;
        this.yandexTts = yandexTts;
        this.googleTts = googleTts;
        this.customTts = customTts;
    }
    async loadEngine(engineUid, vpbxUserUid) {
        return this.ttsEnginesService.findOne(engineUid, vpbxUserUid);
    }
    async synthesizeToBuffer(engine, text, phraseSettings) {
        const merged = (0, ivr_tts_settings_util_1.mergePhraseSettings)(engine.type, engine.settings, phraseSettings);
        const trimmed = text?.trim();
        if (!trimmed) {
            throw new Error('TTS text is empty');
        }
        switch (engine.type) {
            case 'yandex':
                return this.synthesizeYandex(engine.token, trimmed, merged);
            case 'google':
                return this.googleTts.synthesize(engine.token, trimmed, merged);
            case 'custom':
                return this.customTts.synthesize(engine.custom_url || '', trimmed, engine.token, engine.auth_mode, engine.custom_headers, merged);
            default:
                throw new Error(`Unsupported TTS engine type: ${engine.type}`);
        }
    }
    async synthesizeYandex(token, text, settings) {
        const chunks = [];
        await this.yandexTts.synthesizeStream(text, token, settings, (chunk) => chunks.push(chunk));
        const pcm = Buffer.concat(chunks);
        if (!pcm.length) {
            throw new Error('Yandex TTS returned no audio');
        }
        return (0, ivr_pcm_wav_util_1.pcm16ToWav)(pcm, 8000, 1);
    }
};
exports.IvrTtsService = IvrTtsService;
exports.IvrTtsService = IvrTtsService = IvrTtsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tts_engines_service_1.TtsEnginesService,
        yandex_streaming_tts_provider_1.YandexStreamingTtsProvider,
        ivr_tts_google_provider_1.IvrTtsGoogleProvider,
        ivr_tts_custom_provider_1.IvrTtsCustomProvider])
], IvrTtsService);
//# sourceMappingURL=ivr-tts.service.js.map