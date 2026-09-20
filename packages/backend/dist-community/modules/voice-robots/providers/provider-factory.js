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
var SttProviderFactory_1, TtsProviderFactory_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TtsProviderFactory = exports.SttProviderFactory = void 0;
const common_1 = require("@nestjs/common");
const yandex_streaming_stt_provider_1 = require("./yandex-streaming-stt.provider");
const yandex_streaming_tts_provider_1 = require("./yandex-streaming-tts.provider");
const custom_http_stt_provider_1 = require("./custom-http-stt.provider");
/**
 * STT Provider Factory.
 *
 * Routes STT requests to the appropriate provider based on engine type:
 * - 'yandex' → YandexStreamingSttProvider (gRPC bidirectional stream)
 * - 'custom' → CustomHttpSttProvider (HTTP REST batch mode)
 * - 'google' → Reserved for future Google Cloud STT integration
 *
 * Supports both streaming and batch modes:
 * - Streaming: createStream() for real-time gRPC bidirectional recognition
 * - Batch: transcribe() for REST-based providers
 */
let SttProviderFactory = SttProviderFactory_1 = class SttProviderFactory {
    yandexStt;
    customStt;
    logger = new common_1.Logger(SttProviderFactory_1.name);
    constructor(yandexStt, customStt) {
        this.yandexStt = yandexStt;
        this.customStt = customStt;
    }
    /**
     * Check if the engine supports streaming mode.
     */
    isStreamingSupported(engine) {
        return engine.type === 'yandex'; // Google will be added later
    }
    /**
     * Create a streaming STT session (for gRPC-capable engines).
     * Throws if the engine doesn't support streaming.
     */
    createStream(engine, language) {
        switch (engine.type) {
            case 'yandex':
                return this.yandexStt.createStream(engine.token, engine.settings || {}, language);
            default:
                throw new Error(`Streaming STT not supported for engine type: ${engine.type}`);
        }
    }
    /**
     * Batch transcribe (for REST-based engines or engines without streaming).
     */
    async transcribe(engine, audioBuffer, language) {
        switch (engine.type) {
            case 'custom':
                return this.customStt.transcribeWithEngine(audioBuffer, language, engine.custom_url || '', engine.token, engine.auth_mode, engine.custom_headers, engine.settings);
            case 'yandex':
                // Yandex also supports batch via file recognition,
                // but for simplicity, we fall back to streaming with accumulation
                this.logger.warn('Yandex STT used in batch mode — consider switching to streaming for lower latency');
                return this.transcribeViaTempStream(engine, audioBuffer, language);
            default:
                this.logger.error(`Unknown STT engine type: ${engine.type}`);
                return { text: '', language };
        }
    }
    /**
     * Fallback: transcribe via a temporary streaming session.
     * Opens a stream, writes all audio, waits for final text, closes.
     */
    transcribeViaTempStream(engine, audioBuffer, language) {
        return new Promise((resolve) => {
            const stream = this.createStream(engine, language);
            let finalText = '';
            const timeout = setTimeout(() => {
                stream.end();
                resolve({ text: finalText, language });
            }, 10000); // 10s safety timeout
            stream.events.on('final', (text) => {
                finalText = text;
            });
            stream.events.on('eou', () => {
                clearTimeout(timeout);
                stream.end();
                resolve({ text: finalText, language });
            });
            stream.events.on('error', () => {
                clearTimeout(timeout);
                resolve({ text: finalText, language });
            });
            stream.events.on('end', () => {
                clearTimeout(timeout);
                resolve({ text: finalText, language });
            });
            // Write all audio at once
            stream.write(audioBuffer);
            // Signal end of audio after a small delay
            setTimeout(() => stream.end(), 500);
        });
    }
};
exports.SttProviderFactory = SttProviderFactory;
exports.SttProviderFactory = SttProviderFactory = SttProviderFactory_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [yandex_streaming_stt_provider_1.YandexStreamingSttProvider,
        custom_http_stt_provider_1.CustomHttpSttProvider])
], SttProviderFactory);
/**
 * TTS Provider Factory.
 *
 * Routes TTS requests to the appropriate provider based on engine type:
 * - 'yandex' → YandexStreamingTtsProvider (gRPC server stream)
 * - 'custom' → Reserved for custom REST-based TTS
 * - 'google' → Reserved for future Google Cloud TTS integration
 */
let TtsProviderFactory = TtsProviderFactory_1 = class TtsProviderFactory {
    yandexTts;
    logger = new common_1.Logger(TtsProviderFactory_1.name);
    constructor(yandexTts) {
        this.yandexTts = yandexTts;
    }
    /**
     * Get the streaming TTS provider for an engine.
     */
    getStreamingProvider(engine) {
        switch (engine.type) {
            case 'yandex':
                return this.yandexTts;
            default:
                this.logger.warn(`No streaming TTS provider for engine type: ${engine.type}`);
                return null;
        }
    }
    /**
     * Synthesize text using the appropriate engine.
     * Streams PCM16 chunks to the callback as they arrive.
     */
    async synthesize(engine, text, onChunk, signal) {
        switch (engine.type) {
            case 'yandex':
                return this.yandexTts.synthesizeStream(text, engine.token, engine.settings || {}, onChunk, signal);
            default:
                this.logger.error(`No TTS provider for engine type: ${engine.type}`);
                throw new Error(`Unsupported TTS engine type: ${engine.type}`);
        }
    }
    /**
     * Batch synthesize: accumulates all streaming chunks into a single PCM16 buffer.
     * Used by batch/cache mode (TtsCacheService) where the full audio is needed at once.
     *
     * @param engine TTS engine configuration
     * @param text Text to synthesize
     * @returns Complete PCM16 audio buffer (LINEAR16, engine's native sample rate)
     */
    async synthesizeBatch(engine, text) {
        const chunks = [];
        await this.synthesize(engine, text, (pcm16) => chunks.push(pcm16));
        return Buffer.concat(chunks);
    }
};
exports.TtsProviderFactory = TtsProviderFactory;
exports.TtsProviderFactory = TtsProviderFactory = TtsProviderFactory_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [yandex_streaming_tts_provider_1.YandexStreamingTtsProvider])
], TtsProviderFactory);
//# sourceMappingURL=provider-factory.js.map