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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var IvrsInternalController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IvrsInternalController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dialplan_api_key_1 = require("../dialplan-bridge/dialplan-api-key");
const ivrs_service_1 = require("./ivrs.service");
const ivr_tts_service_1 = require("./ivr-tts.service");
const ivr_tts_cache_service_1 = require("./ivr-tts-cache.service");
const ivr_prompts_util_1 = require("./ivr-prompts.util");
/**
 * Internal endpoints for Asterisk dialplan (CURL).
 * GET /api/internal/ivr/play-phrase
 */
let IvrsInternalController = IvrsInternalController_1 = class IvrsInternalController {
    ivrsService;
    ivrTtsService;
    ttsCache;
    config;
    logger = new common_1.Logger(IvrsInternalController_1.name);
    apiKey;
    constructor(ivrsService, ivrTtsService, ttsCache, config) {
        this.ivrsService = ivrsService;
        this.ivrTtsService = ivrTtsService;
        this.ttsCache = ttsCache;
        this.config = config;
        this.apiKey = this.config.get('DIALPLAN_API_KEY') || '';
    }
    async playPhrase(ivrUidStr, phraseIndexStr, vpbxUserUidStr, uniqueid, queryApiKey) {
        if (!(0, dialplan_api_key_1.timingSafeApiKeyEqual)(this.apiKey, queryApiKey)) {
            this.logger.warn('Unauthorized IVR TTS play-phrase attempt');
            throw new common_1.UnauthorizedException('Invalid API key');
        }
        const ivrUid = parseInt(ivrUidStr, 10);
        const phraseIndex = parseInt(phraseIndexStr, 10);
        const vpbxUserUid = parseInt(vpbxUserUidStr, 10);
        if (!ivrUid || isNaN(phraseIndex) || !vpbxUserUid) {
            return '0';
        }
        try {
            const ivr = await this.ivrsService.findOne(ivrUid, vpbxUserUid);
            const phrases = (0, ivr_prompts_util_1.normalizeIvrPrompts)(ivr.prompts);
            const phrase = phrases[phraseIndex];
            if (!phrase || phrase.kind !== 'tts') {
                this.logger.warn(`play-phrase: invalid phrase index ${phraseIndex} for ivr ${ivrUid}`);
                return '0';
            }
            const engine = await this.ivrTtsService.loadEngine(phrase.engine_uid, vpbxUserUid);
            const wav = await this.ivrTtsService.synthesizeToBuffer(engine, phrase.text, phrase.settings);
            const cacheKey = ivr_tts_cache_service_1.IvrTtsCacheService.buildCacheKey({
                ivrUid,
                phraseIndex,
                text: phrase.text,
                engine_uid: phrase.engine_uid,
                settings: phrase.settings,
                uniqueid: uniqueid || '',
            });
            const filePath = this.ttsCache.writeWav(vpbxUserUid, cacheKey, wav);
            return filePath;
        }
        catch (err) {
            this.logger.error(`play-phrase failed: ${err.message}`);
            return '0';
        }
    }
};
exports.IvrsInternalController = IvrsInternalController;
__decorate([
    (0, common_1.Get)('play-phrase'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Query)('ivr_uid')),
    __param(1, (0, common_1.Query)('phrase_index')),
    __param(2, (0, common_1.Query)('vpbx_user_uid')),
    __param(3, (0, common_1.Query)('uniqueid')),
    __param(4, (0, common_1.Query)('api_key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], IvrsInternalController.prototype, "playPhrase", null);
exports.IvrsInternalController = IvrsInternalController = IvrsInternalController_1 = __decorate([
    (0, common_1.Controller)('internal/ivr'),
    __metadata("design:paramtypes", [ivrs_service_1.IvrsService,
        ivr_tts_service_1.IvrTtsService,
        ivr_tts_cache_service_1.IvrTtsCacheService,
        config_1.ConfigService])
], IvrsInternalController);
//# sourceMappingURL=ivrs-internal.controller.js.map