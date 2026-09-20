"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DialplanBridgeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialplanBridgeService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const sequelize_1 = require("@nestjs/sequelize");
const path = __importStar(require("path"));
const mailer_service_1 = require("../mailer/mailer.service");
const telegram_service_1 = require("../telegram/telegram.service");
const numbers_service_1 = require("../numbers/numbers.service");
const tts_engines_service_1 = require("../tts-engines/tts-engines.service");
const ivr_tts_service_1 = require("../ivrs/ivr-tts.service");
const ivr_tts_cache_service_1 = require("../ivrs/ivr-tts-cache.service");
const route_model_1 = require("../routes/route.model");
const dialplan_util_1 = require("../../shared/utils/dialplan.util");
const dialplan_http_util_1 = require("../../shared/utils/dialplan-http.util");
function isHttpUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }
    catch {
        return false;
    }
}
function pickCallerId(numbers, clidnum) {
    if (Array.isArray(numbers)) {
        const mapped = numbers.find((item) => {
            if (typeof item === 'string')
                return item === clidnum;
            if (item && typeof item === 'object' && 'from' in item) {
                return String(item.from) === clidnum;
            }
            return false;
        });
        if (typeof mapped === 'string')
            return mapped;
        if (mapped && typeof mapped === 'object' && 'to' in mapped) {
            return String(mapped.to ?? '');
        }
        const first = numbers.find((item) => typeof item === 'string' && item);
        return typeof first === 'string' ? first : '';
    }
    if (numbers && typeof numbers === 'object') {
        const map = numbers;
        if (clidnum && map[clidnum] != null)
            return String(map[clidnum]);
        if (Array.isArray(map.numbers))
            return pickCallerId(map.numbers, clidnum);
    }
    return '';
}
let DialplanBridgeService = DialplanBridgeService_1 = class DialplanBridgeService {
    numbers;
    http;
    mailer;
    telegramBot;
    ttsEngines;
    ivrTts;
    ttsCache;
    routeModel;
    logger = new common_1.Logger(DialplanBridgeService_1.name);
    constructor(numbers, http, mailer, telegramBot, ttsEngines, ivrTts, ttsCache, routeModel) {
        this.numbers = numbers;
        this.http = http;
        this.mailer = mailer;
        this.telegramBot = telegramBot;
        this.ttsEngines = ttsEngines;
        this.ivrTts = ivrTts;
        this.ttsCache = ttsCache;
        this.routeModel = routeModel;
    }
    async setclid(body) {
        const listUid = Number(body.list_uid);
        const tenant = Number(body.vpbx_user_uid);
        if (!Number.isFinite(listUid) || !Number.isFinite(tenant)) {
            return { callerid: '' };
        }
        const list = await this.numbers.findById(listUid, tenant);
        if (!list)
            return { callerid: '' };
        return { callerid: pickCallerId(list.numbers, String(body.clidnum ?? '')) };
    }
    async webhook(body) {
        const url = String(body.url ?? '');
        if (!isHttpUrl(url)) {
            this.logger.warn('Dialplan webhook skipped: invalid or non-http(s) URL');
            return { body: '', error: 'invalid_url' };
        }
        try {
            const response = await this.http.axiosRef.post(url, {
                clid: body.clid ?? '',
                exten: body.exten ?? '',
                uniqueid: body.uniqueid ?? '',
                vpbx_user_uid: body.vpbx_user_uid ?? '',
            }, { timeout: 5_000, maxRedirects: 0 });
            const data = response?.data;
            return { body: typeof data === 'string' ? data : JSON.stringify(data ?? '') };
        }
        catch (e) {
            this.logger.error(`Dialplan webhook failed: ${e?.message ?? e}`);
            return { body: '', error: e?.message ?? 'webhook_failed' };
        }
    }
    async httpRequest(body) {
        const url = String(body.url ?? '').trim();
        if (!url)
            return '';
        try {
            (0, dialplan_http_util_1.assertSafeHttpUrl)(url);
        }
        catch (e) {
            this.logger.warn(`Dialplan http-request rejected URL: ${e?.message ?? e}`);
            return '';
        }
        const method = String(body.method ?? 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET';
        const timeoutRaw = Number(body.timeout);
        const timeoutMs = (Number.isFinite(timeoutRaw) && timeoutRaw > 0
            ? Math.min(Math.floor(timeoutRaw), 60)
            : dialplan_http_util_1.HTTP_REQUEST_DEFAULT_TIMEOUT) * 1000;
        const headers = await this.resolveHttpRequestHeaders(body);
        try {
            const response = await this.http.axiosRef.request({
                url,
                method,
                data: method === 'POST' ? (body.body ?? '') : undefined,
                timeout: timeoutMs,
                maxRedirects: 0,
                headers,
                validateStatus: () => true,
            });
            const data = response?.data;
            return typeof data === 'string' ? data : JSON.stringify(data ?? '');
        }
        catch (e) {
            this.logger.error(`Dialplan http-request failed: ${e?.message ?? e}`);
            return '';
        }
    }
    async resolveHttpRequestHeaders(body) {
        const routeUid = String(body.route_uid ?? '').trim();
        const actionId = String(body.action_id ?? '').trim();
        const tenant = Number(body.vpbx_user_uid);
        if (!routeUid || !actionId || !Number.isFinite(tenant)) {
            return {};
        }
        const uid = parseInt(routeUid, 10);
        if (!uid)
            return {};
        const route = await this.routeModel.findOne({ where: { uid, user_uid: tenant } });
        const actions = Array.isArray(route?.actions) ? route.actions : [];
        const action = actions.find((item) => item?.id === actionId && item?.type === 'http_request');
        return (0, dialplan_http_util_1.pickAllowedHttpHeaders)(action?.params?.headers);
    }
    async sendmailpeer(body) {
        try {
            const to = String(body.exten ?? '');
            if (to.includes('@')) {
                await this.mailer.sendNotification({
                    to,
                    text: body.text ?? '',
                });
            }
            else {
                await this.mailer.sendNotification({
                    to: `${to}@localhost`,
                    text: body.text ?? '',
                });
            }
        }
        catch (e) {
            this.logger.error(`sendmailpeer failed: ${e?.message ?? e}`);
        }
        return { accepted: true };
    }
    async telegram(body) {
        try {
            const text = [
                body.text ?? '',
                body.chat_id ? `chat_id=${body.chat_id}` : '',
                body.clid ? `clid=${body.clid}` : '',
            ].filter(Boolean).join('\n');
            await this.telegramBot.sendMessage(text);
        }
        catch (e) {
            this.logger.error(`telegram notify failed: ${e?.message ?? e}`);
        }
        return { accepted: true };
    }
    async tts(body) {
        const tenant = Number(body.vpbx_user_uid);
        const engineUid = Number(body.engine);
        const text = String(body.text ?? '').trim();
        const engines = Number.isFinite(tenant)
            ? await this.ttsEngines.findAll(tenant)
            : [];
        const engine = engines.find((item) => item.uid === engineUid);
        if (!engine) {
            throw new common_1.BadRequestException('Unknown TTS engine');
        }
        const settings = {};
        if (body.voice)
            settings.voice = body.voice;
        if (body.language_code)
            settings.language_code = body.language_code;
        if (body.speed)
            settings.speed = body.speed;
        if (body.speaking_rate)
            settings.speaking_rate = body.speaking_rate;
        if (body.role)
            settings.role = body.role;
        if (body.pitch_shift)
            settings.pitch_shift = body.pitch_shift;
        try {
            const wav = await this.ivrTts.synthesizeToBuffer(engine, text, settings);
            const cacheKey = ivr_tts_cache_service_1.IvrTtsCacheService.buildCacheKey({
                engine: engineUid,
                text,
                settings,
            });
            const written = this.ttsCache.writeWav(tenant, cacheKey, wav);
            const file = dialplan_util_1.AsteriskDialplanUtils.sanitizeFilePath(path.basename(written).replace(/\.[^.]+$/, ''));
            return { status: 'ok', file };
        }
        catch (e) {
            this.logger.error(`TTS engine failed: ${e?.message ?? e}`);
            return { status: 'error', file: '' };
        }
    }
};
exports.DialplanBridgeService = DialplanBridgeService;
exports.DialplanBridgeService = DialplanBridgeService = DialplanBridgeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, sequelize_1.InjectModel)(route_model_1.Route)),
    __metadata("design:paramtypes", [numbers_service_1.NumbersService,
        axios_1.HttpService,
        mailer_service_1.MailerService,
        telegram_service_1.TelegramService,
        tts_engines_service_1.TtsEnginesService,
        ivr_tts_service_1.IvrTtsService,
        ivr_tts_cache_service_1.IvrTtsCacheService, Object])
], DialplanBridgeService);
//# sourceMappingURL=dialplan-bridge.service.js.map