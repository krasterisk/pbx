"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var IvrTtsCustomProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IvrTtsCustomProvider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const ivr_pcm_wav_util_1 = require("./ivr-pcm-wav.util");
let IvrTtsCustomProvider = IvrTtsCustomProvider_1 = class IvrTtsCustomProvider {
    logger = new common_1.Logger(IvrTtsCustomProvider_1.name);
    async synthesize(url, text, token, authMode, customHeaders, settings) {
        if (!url?.trim()) {
            throw new Error('Custom TTS URL is not configured');
        }
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'audio/*,application/octet-stream',
            ...(customHeaders || {}),
        };
        if (token) {
            if (authMode === 'bearer') {
                headers.Authorization = `Bearer ${token}`;
            }
        }
        const response = await axios_1.default.post(url, { text, settings: settings || {} }, {
            headers,
            timeout: settings?.timeout_ms || 30000,
            responseType: 'arraybuffer',
            validateStatus: (s) => s >= 200 && s < 300,
        });
        let audio = Buffer.from(response.data);
        const contentType = String(response.headers['content-type'] || '');
        if (contentType.includes('wav') || audio.slice(0, 4).toString() === 'RIFF') {
            return audio;
        }
        // Raw PCM16 8kHz mono
        if (contentType.includes('pcm') || settings?.format === 'pcm16') {
            return (0, ivr_pcm_wav_util_1.pcm16ToWav)(audio, 8000, 1);
        }
        // MP3 or unknown — return as-is (preview may still work in browser)
        return audio;
    }
};
exports.IvrTtsCustomProvider = IvrTtsCustomProvider;
exports.IvrTtsCustomProvider = IvrTtsCustomProvider = IvrTtsCustomProvider_1 = __decorate([
    (0, common_1.Injectable)()
], IvrTtsCustomProvider);
//# sourceMappingURL=ivr-tts-custom.provider.js.map