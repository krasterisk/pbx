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
var StreamAudioService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamAudioService = void 0;
const common_1 = require("@nestjs/common");
const dgram = __importStar(require("dgram"));
let StreamAudioService = class StreamAudioService {
    static { StreamAudioService_1 = this; }
    logger = new common_1.Logger(StreamAudioService_1.name);
    streams = new Map();
    RTP_SSRC = Math.floor(Math.random() * 0xffffffff);
    server;
    /** A-law payload type in RTP header */
    static PAYLOAD_TYPE_ALAW = 0x08;
    /** 160 bytes alaw = 20ms of audio @ 8kHz */
    static PACKET_SIZE = 160;
    /** RTP packet interval in milliseconds */
    static PACKET_DURATION_MS = 20;
    constructor() {
        this.server = dgram.createSocket('udp4');
    }
    /**
     * Initialize a stream for a given session (channel).
     * Must be called before streamAudio().
     */
    addStream(sessionId, targetAddress, targetPort) {
        if (this.streams.has(sessionId))
            return;
        this.streams.set(sessionId, {
            bufferQueue: [],
            isProcessing: false,
            seq: Math.floor(Math.random() * 65535),
            timestamp: 0,
            abortController: new AbortController(),
            targetAddress,
            targetPort,
        });
        this.logger.log(`Stream ${sessionId} initialized → ${targetAddress}:${targetPort}`);
    }
    /**
     * Remove and cleanup a stream.
     */
    removeStream(sessionId) {
        const state = this.streams.get(sessionId);
        if (state) {
            state.abortController.abort();
            this.streams.delete(sessionId);
            this.logger.log(`Stream ${sessionId} removed`);
        }
    }
    /**
     * Interrupt current playback (barge-in).
     * Clears the audio queue and creates a fresh AbortController.
     */
    interruptStream(sessionId) {
        const state = this.streams.get(sessionId);
        if (state) {
            state.abortController.abort();
            state.bufferQueue.length = 0;
            state.abortController = new AbortController();
            state.isProcessing = false;
            this.logger.log(`Stream ${sessionId} interrupted`);
        }
    }
    /**
     * Queue an A-law audio buffer for RTP transmission.
     * The buffer will be split into 160-byte packets and sent at 20ms intervals.
     */
    async streamAudio(sessionId, alawBuffer) {
        const state = this.streams.get(sessionId);
        if (!state) {
            this.logger.warn(`Stream ${sessionId} not found`);
            return;
        }
        state.bufferQueue.push(alawBuffer);
        if (!state.isProcessing) {
            state.isProcessing = true;
            // Await actual playback completion so callers (speakBatch) can
            // correctly track when audio finishes playing over RTP.
            await this.processQueue(sessionId, state);
        }
        else {
            // Another processQueue loop is already running.
            // Return a promise that resolves when the queue drains.
            return new Promise((resolve) => {
                const check = () => {
                    if (!state.isProcessing || state.abortController.signal.aborted) {
                        resolve();
                    }
                    else {
                        setTimeout(check, 50);
                    }
                };
                setTimeout(check, 50);
            });
        }
    }
    /**
     * Process the buffer queue sequentially.
     */
    async processQueue(sessionId, state) {
        const { abortController } = state;
        while (state.bufferQueue.length > 0 && !abortController.signal.aborted) {
            const buffer = state.bufferQueue.shift();
            await this.sendBuffer(sessionId, buffer, abortController);
        }
        state.isProcessing = false;
    }
    /**
     * Send a single buffer as a sequence of RTP packets with timing control.
     */
    sendBuffer(sessionId, buffer, abortController) {
        return new Promise((resolve) => {
            if (abortController.signal.aborted)
                return resolve();
            let offset = 0;
            const startTime = Date.now();
            const sendNextPacket = () => {
                if (abortController.signal.aborted || offset >= buffer.length) {
                    return resolve();
                }
                const chunk = buffer.subarray(offset, offset + StreamAudioService_1.PACKET_SIZE);
                this.sendRtpPacket(sessionId, chunk);
                offset += StreamAudioService_1.PACKET_SIZE;
                const nextPacketTime = startTime +
                    (offset / StreamAudioService_1.PACKET_SIZE) *
                        StreamAudioService_1.PACKET_DURATION_MS;
                const delay = Math.max(0, nextPacketTime - Date.now());
                setTimeout(sendNextPacket, delay);
            };
            sendNextPacket();
        });
    }
    /**
     * Build and send a single RTP packet.
     */
    sendRtpPacket(sessionId, chunk) {
        const state = this.streams.get(sessionId);
        if (!state)
            return;
        const rtpPacket = this.buildRTPPacket(chunk, state.seq, state.timestamp, this.RTP_SSRC, StreamAudioService_1.PAYLOAD_TYPE_ALAW);
        state.seq = (state.seq + 1) & 0xffff;
        state.timestamp += StreamAudioService_1.PACKET_SIZE;
        this.server.send(rtpPacket, state.targetPort, state.targetAddress, (err) => {
            if (err)
                this.logger.error(`Send RTP error [${sessionId}]: ${err}`);
        });
    }
    /**
     * Construct a standard RTP packet header (12 bytes) + payload.
     */
    buildRTPPacket(payload, seq, timestamp, ssrc, payloadType) {
        const header = Buffer.alloc(12);
        header.writeUInt8(0x80, 0); // Version=2, P=0, X=0, CC=0
        header.writeUInt8(payloadType, 1);
        header.writeUInt16BE(seq, 2);
        header.writeUInt32BE(timestamp, 4);
        header.writeUInt32BE(ssrc, 8);
        return Buffer.concat([header, payload]);
    }
};
exports.StreamAudioService = StreamAudioService;
exports.StreamAudioService = StreamAudioService = StreamAudioService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], StreamAudioService);
//# sourceMappingURL=stream-audio.service.js.map