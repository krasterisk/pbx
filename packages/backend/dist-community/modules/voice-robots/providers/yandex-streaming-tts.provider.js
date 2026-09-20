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
var YandexStreamingTtsProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.YandexStreamingTtsProvider = void 0;
const common_1 = require("@nestjs/common");
const grpc = __importStar(require("@grpc/grpc-js"));
const protoLoader = __importStar(require("@grpc/proto-loader"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const yandex_grpc_util_1 = require("./yandex-grpc.util");
/**
 * Yandex SpeechKit Streaming TTS Provider (gRPC API v3).
 *
 * Uses server-side gRPC stream: Synthesizer.UtteranceSynthesis
 * - Sends text as a unary request
 * - Receives PCM16 audio chunks as a server stream
 *
 * Output: LINEAR16_PCM, 8000 Hz (telephony-optimized)
 * First-byte latency: ~100-200ms (streaming delivery)
 *
 * Proto source: github.com/yandex-cloud/cloudapi
 * Endpoint: tts.api.cloud.yandex.net:443
 *
 * Verbose wire logging: DEBUG_YANDEX_SPEECHKIT=1 or DEBUG_YANDEX_TTS=1
 *
 * @see https://yandex.cloud/docs/speechkit/tts/api/tts-v3
 */
let YandexStreamingTtsProvider = class YandexStreamingTtsProvider {
    static { YandexStreamingTtsProvider_1 = this; }
    name = 'yandex-tts-streaming';
    logger = new common_1.Logger(YandexStreamingTtsProvider_1.name);
    verbose = (0, yandex_grpc_util_1.isYandexSpeechVerbose)();
    synthesizerClient = null;
    protoLoaded = false;
    static ENDPOINT = 'tts.api.cloud.yandex.net:443';
    /**
     * Lazy-initialize the gRPC client.
     */
    ensureClient() {
        if (this.protoLoaded)
            return;
        const protoDir = path.join(__dirname, '..', 'proto', 'cloudapi');
        const ttsServiceProto = path.join(protoDir, 'yandex', 'cloud', 'ai', 'tts', 'v3', 'tts_service.proto');
        if (!fs.existsSync(ttsServiceProto)) {
            throw new Error(`Yandex Cloud proto files not found at ${protoDir}. ` +
                `Run: git clone --depth=1 https://github.com/yandex-cloud/cloudapi.git ${protoDir}`);
        }
        const packageDefinition = protoLoader.loadSync(ttsServiceProto, {
            includeDirs: [protoDir, path.join(protoDir, 'third_party', 'googleapis')],
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        const proto = grpc.loadPackageDefinition(packageDefinition);
        this.synthesizerClient = new proto.speechkit.tts.v3.Synthesizer(YandexStreamingTtsProvider_1.ENDPOINT, grpc.credentials.createSsl());
        this.protoLoaded = true;
        this.logger.log(`Yandex TTS gRPC client initialized (endpoint: ${YandexStreamingTtsProvider_1.ENDPOINT})`);
    }
    /**
     * Synthesize text and stream PCM16 8kHz chunks via callback.
     *
     * Each chunk is delivered as soon as the server produces it (~100-200ms first-byte).
     * The caller should convert PCM16 → A-law and feed to StreamAudioService for RTP delivery.
     *
     * @param text Text to synthesize
     * @param token IAM token or API key
     * @param settings { folder_id, voice, role, speed, pitch_shift }
     * @param onChunk Called for each PCM16 audio chunk
     * @param signal AbortSignal for barge-in interrupt
     */
    async synthesizeStream(text, token, settings, onChunk, signal) {
        this.ensureClient();
        if (!text?.trim()) {
            this.logger.warn('[Yandex TTS] Empty text — skipping synthesis');
            return;
        }
        (0, yandex_grpc_util_1.logYandexEngineConfig)(this.logger, 'TTS', token, settings, {
            voice: settings.voice || 'default',
            speed: settings.speed,
            role: settings.role,
        });
        const metadata = new grpc.Metadata();
        metadata.add('authorization', `Bearer ${token}`);
        if (settings.folder_id) {
            metadata.add('x-folder-id', settings.folder_id);
        }
        const hints = [];
        if (settings.voice) {
            hints.push({ voice: settings.voice });
        }
        if (settings.speed && settings.speed !== 1.0) {
            hints.push({ speed: settings.speed });
        }
        if (settings.role) {
            hints.push({ role: settings.role });
        }
        if (settings.pitch_shift) {
            hints.push({ pitch_shift: settings.pitch_shift });
        }
        const request = {
            text: text,
            output_audio_spec: {
                raw_audio: {
                    audio_encoding: 1, // LINEAR16_PCM
                    sample_rate_hertz: 8000,
                },
            },
            hints: hints,
            loudness_normalization_type: 1, // MAX_PEAK
            unsafe_mode: false,
        };
        this.logger.log(`[Yandex TTS] Synthesis start: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" ` +
            `(voice: ${settings.voice || 'default'}, chars: ${text.length})`);
        return new Promise((resolve, reject) => {
            const stream = this.synthesizerClient.UtteranceSynthesis(request, metadata);
            let totalBytes = 0;
            let chunkCount = 0;
            let aborted = false;
            let firstChunkLogged = false;
            if (signal) {
                const onAbort = () => {
                    if (!aborted) {
                        aborted = true;
                        stream.cancel();
                        this.logger.debug('[Yandex TTS] Stream cancelled (barge-in)');
                        resolve();
                    }
                };
                signal.addEventListener('abort', onAbort, { once: true });
            }
            stream.on('data', (response) => {
                if (aborted)
                    return;
                if (this.verbose) {
                    this.logger.debug(`[Yandex TTS] ← ${(0, yandex_grpc_util_1.summarizeTtsResponse)(response)}`);
                }
                if (response.audio_chunk?.data) {
                    const pcm16 = Buffer.from(response.audio_chunk.data);
                    totalBytes += pcm16.length;
                    chunkCount++;
                    if (!firstChunkLogged) {
                        firstChunkLogged = true;
                        this.logger.debug(`[Yandex TTS] First audio chunk: ${pcm16.length} bytes`);
                    }
                    onChunk(pcm16);
                }
                else if (this.verbose) {
                    this.logger.debug('[Yandex TTS] Data message without audio_chunk');
                }
            });
            stream.on('end', () => {
                if (aborted)
                    return;
                if (totalBytes === 0) {
                    this.logger.error('[Yandex TTS] Synthesis finished with 0 bytes — check token, folder_id, voice, billing/quota. ' +
                        'No gRPC error was raised; response may be empty.');
                    reject(new Error('Yandex TTS returned no audio data'));
                    return;
                }
                this.logger.debug(`[Yandex TTS] Synthesis complete: ${totalBytes} bytes PCM16, ${chunkCount} chunk(s)`);
                resolve();
            });
            stream.on('error', (err) => {
                if (aborted || err.code === grpc.status.CANCELLED) {
                    if (this.verbose) {
                        this.logger.debug('[Yandex TTS] Stream cancelled (local close)');
                    }
                    resolve();
                    return;
                }
                (0, yandex_grpc_util_1.logGrpcError)(this.logger, '[Yandex TTS] Stream error:', err);
                reject(err);
            });
        });
    }
};
exports.YandexStreamingTtsProvider = YandexStreamingTtsProvider;
exports.YandexStreamingTtsProvider = YandexStreamingTtsProvider = YandexStreamingTtsProvider_1 = __decorate([
    (0, common_1.Injectable)()
], YandexStreamingTtsProvider);
//# sourceMappingURL=yandex-streaming-tts.provider.js.map