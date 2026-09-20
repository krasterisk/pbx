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
var YandexStreamingSttProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.YandexStreamingSttProvider = void 0;
const common_1 = require("@nestjs/common");
const events_1 = require("events");
const grpc = __importStar(require("@grpc/grpc-js"));
const protoLoader = __importStar(require("@grpc/proto-loader"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const yandex_grpc_util_1 = require("./yandex-grpc.util");
/**
 * Yandex SpeechKit Streaming STT Provider (gRPC API v3).
 *
 * Uses bidirectional gRPC stream: Recognizer.RecognizeStreaming
 * - Sends PCM16 8kHz mono audio chunks in real-time
 * - Receives partial → final → eou_update events
 *
 * Proto source: github.com/yandex-cloud/cloudapi
 * Endpoint: stt.api.cloud.yandex.net:443
 *
 * Audio format: LINEAR16_PCM, 8000 Hz, 1 channel (telephony standard)
 *
 * Verbose wire logging: DEBUG_YANDEX_SPEECHKIT=1 or DEBUG_YANDEX_STT=1
 *
 * @see https://yandex.cloud/docs/speechkit/stt/api/streaming-examples-v3
 */
let YandexStreamingSttProvider = class YandexStreamingSttProvider {
    static { YandexStreamingSttProvider_1 = this; }
    name = 'yandex-stt-streaming';
    logger = new common_1.Logger(YandexStreamingSttProvider_1.name);
    verbose = (0, yandex_grpc_util_1.isYandexSpeechVerbose)();
    recognizerClient = null;
    protoLoaded = false;
    static ENDPOINT = 'stt.api.cloud.yandex.net:443';
    /**
     * Lazy-initialize the gRPC client.
     * Proto files are loaded dynamically from the cloudapi directory.
     */
    ensureClient() {
        if (this.protoLoaded)
            return;
        const protoDir = path.join(__dirname, '..', 'proto', 'cloudapi');
        const sttServiceProto = path.join(protoDir, 'yandex', 'cloud', 'ai', 'stt', 'v3', 'stt_service.proto');
        // Check if proto files exist
        if (!fs.existsSync(sttServiceProto)) {
            throw new Error(`Yandex Cloud proto files not found at ${protoDir}. ` +
                `Run: git clone --depth=1 https://github.com/yandex-cloud/cloudapi.git ${protoDir}`);
        }
        const packageDefinition = protoLoader.loadSync(sttServiceProto, {
            includeDirs: [protoDir, path.join(protoDir, 'third_party', 'googleapis')],
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        const proto = grpc.loadPackageDefinition(packageDefinition);
        this.recognizerClient = new proto.speechkit.stt.v3.Recognizer(YandexStreamingSttProvider_1.ENDPOINT, grpc.credentials.createSsl());
        this.protoLoaded = true;
        this.logger.log(`Yandex STT gRPC client initialized (endpoint: ${YandexStreamingSttProvider_1.ENDPOINT})`);
    }
    /**
     * Create a new bidirectional streaming recognition session.
     *
     * @param token IAM token or API key
     * @param settings { folder_id, model, eou_sensitivity }
     * @param language Language code (e.g. 'ru-RU')
     */
    createStream(token, settings, language) {
        this.ensureClient();
        (0, yandex_grpc_util_1.logYandexEngineConfig)(this.logger, 'STT', token, settings, {
            model: settings.model || 'general',
            lang: language || 'ru-RU',
            eou: settings.eou_sensitivity || 'DEFAULT',
        });
        const metadata = new grpc.Metadata();
        metadata.add('authorization', `Bearer ${token}`);
        if (settings.folder_id) {
            metadata.add('x-folder-id', settings.folder_id);
        }
        const grpcStream = this.recognizerClient.RecognizeStreaming(metadata);
        const events = new events_1.EventEmitter();
        let emptyPartialCount = 0;
        // Send SessionOptions as the first message
        const sessionOptions = {
            session_options: {
                recognition_model: {
                    model: settings.model || 'general',
                    audio_format: {
                        raw_audio: {
                            audio_encoding: 1, // LINEAR16_PCM
                            sample_rate_hertz: 8000,
                            audio_channel_count: 1,
                        },
                    },
                    text_normalization: {
                        text_normalization: 1, // TEXT_NORMALIZATION_ENABLED
                    },
                    audio_processing_type: 1, // REAL_TIME
                    language_restriction: {
                        restriction_type: 1, // WHITELIST
                        language_code: [language || 'ru-RU'],
                    },
                },
                eou_classifier: {
                    default_classifier: {
                        type: this.mapEouSensitivity(settings.eou_sensitivity),
                    },
                },
            },
        };
        try {
            grpcStream.write(sessionOptions);
        }
        catch (e) {
            this.logger.error(`[Yandex STT] Failed to send session_options: ${e.message}`);
            throw e;
        }
        this.logger.log(`STT stream opened (model: ${settings.model || 'general'}, lang: ${language})`);
        // Handle server responses
        grpcStream.on('data', (response) => {
            try {
                if (this.verbose) {
                    this.logger.debug(`[Yandex STT] ← ${(0, yandex_grpc_util_1.summarizeSttResponse)(response)}`);
                }
                if (response.partial) {
                    const text = response.partial.alternatives?.[0]?.text || '';
                    if (text) {
                        events.emit('partial', text);
                    }
                    else {
                        emptyPartialCount++;
                        if (emptyPartialCount === 1 || emptyPartialCount % 20 === 0) {
                            this.logger.debug(`[Yandex STT] Empty partial (#${emptyPartialCount}) — audio received but no text yet`);
                        }
                    }
                }
                if (response.final) {
                    const text = response.final.alternatives?.[0]?.text || '';
                    if (text) {
                        this.logger.debug(`[Yandex STT] Final: "${text}"`);
                        events.emit('final', text);
                    }
                    else {
                        this.logger.debug('[Yandex STT] Final event with empty text');
                    }
                }
                if (response.final_refinement) {
                    const normalized = response.final_refinement.normalized_text?.alternatives?.[0]?.text || '';
                    if (normalized) {
                        this.logger.debug(`[Yandex STT] Normalized: "${normalized}"`);
                        events.emit('normalized', normalized);
                    }
                }
                if (response.eou_update) {
                    this.logger.debug(`[Yandex STT] EOU at ${response.eou_update.time_ms}ms`);
                    events.emit('eou');
                }
                if (response.status_code) {
                    this.handleStatusCode(response.status_code, events);
                }
                if (response.session_uuid && this.verbose) {
                    this.logger.debug(`[Yandex STT] session_uuid=${response.session_uuid.uuid || '(none)'}`);
                }
            }
            catch (e) {
                this.logger.error(`[Yandex STT] Error processing response: ${e.message}`, e.stack);
            }
        });
        grpcStream.on('error', (err) => {
            // gRPC CANCELLED (code 1) is expected when we close the stream
            if (err.code === grpc.status.CANCELLED) {
                if (this.verbose) {
                    this.logger.debug('[Yandex STT] Stream cancelled (local close)');
                }
                return;
            }
            (0, yandex_grpc_util_1.logGrpcError)(this.logger, '[Yandex STT] Stream error:', err);
            events.emit('error', err);
        });
        grpcStream.on('end', () => {
            this.logger.debug('[Yandex STT] gRPC stream ended');
            events.emit('end');
        });
        return {
            write: (pcm16) => {
                try {
                    grpcStream.write({ chunk: { data: pcm16 } });
                }
                catch (e) {
                    this.logger.warn(`[Yandex STT] Write failed (stream closed?): ${e.message}`);
                }
            },
            end: () => {
                try {
                    grpcStream.end();
                }
                catch (e) {
                    if (this.verbose) {
                        this.logger.debug(`[Yandex STT] end() ignored: ${e.message}`);
                    }
                }
            },
            events,
        };
    }
    handleStatusCode(status, events) {
        const code = status.code_type;
        const msg = status.message?.trim() || '';
        if (code === 'WORKING' || code === 1) {
            if (this.verbose && msg) {
                this.logger.debug(`[Yandex STT] Status WORKING: ${msg}`);
            }
            return;
        }
        if (code === 'WARNING' || code === 2) {
            this.logger.warn(`[Yandex STT] Status WARNING${msg ? `: ${msg}` : ''} — recognition may be degraded (latency/fallback)`);
            return;
        }
        if (code === 'CLOSED' || code === 3) {
            this.logger.debug(`[Yandex STT] Session closed by server${msg ? ` (${msg})` : ''}`);
            events.emit('end');
            return;
        }
        this.logger.warn(`[Yandex STT] Unknown status_code: ${code}${msg ? ` — ${msg}` : ''}`);
    }
    /**
     * Map EOU sensitivity string to proto enum value.
     */
    mapEouSensitivity(sensitivity) {
        switch (sensitivity) {
            case 'HIGH': return 2;
            case 'DEFAULT':
            default: return 1;
        }
    }
};
exports.YandexStreamingSttProvider = YandexStreamingSttProvider;
exports.YandexStreamingSttProvider = YandexStreamingSttProvider = YandexStreamingSttProvider_1 = __decorate([
    (0, common_1.Injectable)()
], YandexStreamingSttProvider);
//# sourceMappingURL=yandex-streaming-stt.provider.js.map