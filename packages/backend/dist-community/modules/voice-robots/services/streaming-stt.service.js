"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var StreamingSttService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamingSttService = void 0;
const common_1 = require("@nestjs/common");
/**
 * STT (Speech-to-Text) service.
 *
 * Implements ISttProvider interface. Supports pluggable providers
 * via HTTP REST API (compatible with Yandex SpeechKit, Google Cloud STT,
 * OpenAI Whisper, and self-hosted Vosk/faster-whisper).
 *
 * Currently a functional stub with configurable backend URL.
 * To enable real STT, configure the stt_engines table with a valid API endpoint.
 */
let StreamingSttService = StreamingSttService_1 = class StreamingSttService {
    name = 'generic-rest-stt';
    logger = new common_1.Logger(StreamingSttService_1.name);
    /**
     * Transcribe audio buffer to text.
     *
     * @param audioBuffer PCM16 8kHz mono audio
     * @param language Language hint (e.g. 'ru-RU')
     */
    async transcribe(audioBuffer, language) {
        this.logger.debug(`[STT] Transcribe request: ${audioBuffer.length} bytes, language: ${language || 'auto'}`);
        // TODO: When STT engine is configured, send audio via HTTP POST:
        //
        // const response = await axios.post(sttEngine.api_url, audioBuffer, {
        //   headers: {
        //     'Content-Type': 'audio/pcm',
        //     'Authorization': `Bearer ${sttEngine.api_key}`,
        //     'X-Sample-Rate': '8000',
        //     'X-Language': language || 'ru-RU',
        //   },
        // });
        // return { text: response.data.text, rawJson: response.data };
        // Stub: return empty result (no STT engine configured)
        this.logger.warn('[STT] No STT engine configured. Returning empty result. ' +
            'Configure stt_engines table for real transcription.');
        return {
            text: '',
            duration: audioBuffer.length / (8000 * 2), // PCM16 @ 8kHz
            language: language || 'ru-RU',
        };
    }
};
exports.StreamingSttService = StreamingSttService;
exports.StreamingSttService = StreamingSttService = StreamingSttService_1 = __decorate([
    (0, common_1.Injectable)()
], StreamingSttService);
//# sourceMappingURL=streaming-stt.service.js.map