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
var CustomHttpSttProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomHttpSttProvider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
/**
 * Custom HTTP STT Provider (REST API fallback).
 *
 * Sends PCM16 audio via HTTP POST to a user-configured STT endpoint.
 * Compatible with:
 * - Faster-Whisper Server (OpenAI API format)
 * - Vosk Server
 * - Any REST API that accepts raw audio and returns JSON with text field
 *
 * This is a batch-mode provider: collects full utterance via VAD → sends to STT.
 */
let CustomHttpSttProvider = CustomHttpSttProvider_1 = class CustomHttpSttProvider {
    name = 'custom-http-stt';
    logger = new common_1.Logger(CustomHttpSttProvider_1.name);
    /**
     * Transcribe audio buffer via HTTP POST to the configured endpoint.
     *
     * @param audioBuffer PCM16 8kHz mono audio
     * @param language Language hint
     * @param url Custom STT endpoint URL
     * @param token Auth token (optional)
     * @param authMode Authentication mode
     * @param customHeaders Additional headers
     * @param settings Provider-specific settings
     */
    async transcribeWithEngine(audioBuffer, language, url, token, authMode, customHeaders, settings) {
        if (!url) {
            this.logger.warn('No custom STT URL configured. Returning empty result.');
            return { text: '', duration: audioBuffer.length / (8000 * 2) };
        }
        const headers = {
            'Content-Type': 'audio/pcm',
            'X-Sample-Rate': '8000',
            'X-Audio-Channels': '1',
            'X-Language': language || 'ru-RU',
            ...customHeaders,
        };
        // Authentication
        if (token) {
            switch (authMode) {
                case 'bearer':
                    headers['Authorization'] = `Bearer ${token}`;
                    break;
                case 'custom':
                    // Custom headers already merged above
                    break;
                default:
                    // 'none' — no auth
                    break;
            }
        }
        try {
            const startTime = Date.now();
            const response = await axios_1.default.post(url, audioBuffer, {
                headers,
                timeout: settings?.timeout_ms || 10000,
                responseType: 'json',
            });
            const elapsed = Date.now() - startTime;
            // Extract text — support multiple response formats
            let text = '';
            const data = response.data;
            if (typeof data === 'string') {
                text = data;
            }
            else if (data?.text) {
                // Standard format: { text: "..." }
                text = data.text;
            }
            else if (data?.result) {
                // Vosk format: { result: [...], text: "..." }
                text = data.text || '';
            }
            else if (data?.results?.[0]?.alternatives?.[0]?.transcript) {
                // Google Cloud format
                text = data.results[0].alternatives[0].transcript;
            }
            else if (data?.choices?.[0]?.message?.content) {
                // OpenAI Whisper API format
                text = data.choices[0].message.content;
            }
            this.logger.debug(`[Custom STT] "${text}" (${elapsed}ms)`);
            return {
                text: text.trim(),
                duration: audioBuffer.length / (8000 * 2),
                language,
                rawJson: data,
            };
        }
        catch (e) {
            this.logger.error(`Custom STT request failed: ${e.message}`);
            return {
                text: '',
                duration: audioBuffer.length / (8000 * 2),
                language,
            };
        }
    }
    /**
     * ISttProvider.transcribe — simplified interface (without engine config).
     * For use in contexts where engine config is not available.
     */
    async transcribe(audioBuffer, language) {
        this.logger.warn('CustomHttpSttProvider.transcribe() called without engine config. Use transcribeWithEngine() instead.');
        return { text: '', duration: audioBuffer.length / (8000 * 2), language: language || 'ru-RU' };
    }
};
exports.CustomHttpSttProvider = CustomHttpSttProvider;
exports.CustomHttpSttProvider = CustomHttpSttProvider = CustomHttpSttProvider_1 = __decorate([
    (0, common_1.Injectable)()
], CustomHttpSttProvider);
//# sourceMappingURL=custom-http-stt.provider.js.map