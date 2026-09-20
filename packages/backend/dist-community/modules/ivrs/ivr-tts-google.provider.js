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
var IvrTtsGoogleProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IvrTtsGoogleProvider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
let IvrTtsGoogleProvider = IvrTtsGoogleProvider_1 = class IvrTtsGoogleProvider {
    logger = new common_1.Logger(IvrTtsGoogleProvider_1.name);
    async synthesize(token, text, settings) {
        const languageCode = settings.language_code || 'ru-RU';
        const voiceName = settings.voice_name || 'ru-RU-Wavenet-A';
        const speakingRate = parseFloat(String(settings.speaking_rate ?? '1.0')) || 1.0;
        const response = await axios_1.default.post('https://texttospeech.googleapis.com/v1/text:synthesize', {
            input: { text },
            voice: { languageCode, name: voiceName },
            audioConfig: {
                audioEncoding: 'LINEAR16',
                sampleRateHertz: 8000,
                speakingRate,
            },
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
        const audioContent = response.data?.audioContent;
        if (!audioContent) {
            throw new Error('Google TTS returned empty audioContent');
        }
        return Buffer.from(audioContent, 'base64');
    }
};
exports.IvrTtsGoogleProvider = IvrTtsGoogleProvider;
exports.IvrTtsGoogleProvider = IvrTtsGoogleProvider = IvrTtsGoogleProvider_1 = __decorate([
    (0, common_1.Injectable)()
], IvrTtsGoogleProvider);
//# sourceMappingURL=ivr-tts-google.provider.js.map