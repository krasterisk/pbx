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
var RtpUdpServerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RtpUdpServerService = exports.RtpSession = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dgram = __importStar(require("dgram"));
const events_1 = require("events");
const audio_service_1 = require("./audio.service");
/**
 * Per-session RTP data container.
 * Holds an ephemeral UDP socket and emits decoded audio events.
 */
class RtpSession {
    audioService;
    eventEmitter = new events_1.EventEmitter();
    port;
    socket;
    logger = new common_1.Logger(RtpSession.name);
    closed = false;
    /** Track whether we've received at least one RTP packet (for NAT remap) */
    rtpReceived = false;
    constructor(audioService, socket, port) {
        this.audioService = audioService;
        this.socket = socket;
        this.port = port;
        this.socket.on('message', (msg, rinfo) => {
            if (this.closed)
                return;
            if (!this.rtpReceived) {
                this.rtpReceived = true;
                this.logger.log(`First RTP packet from ${rinfo.address}:${rinfo.port} → port ${this.port}`);
            }
            try {
                // Strip RTP header (12 bytes)
                const alawPayload = this.audioService.removeRTPHeader(msg);
                // Decode to PCM16 for STT accumulation
                const pcm16 = this.audioService.decodeAlawToPcm16(alawPayload);
                this.eventEmitter.emit('audio-pcm16', pcm16);
                // Decode to Float32 for VAD inference
                const float32 = this.audioService.decodeAlawToFloat32(alawPayload);
                this.eventEmitter.emit('audio-float32', float32);
            }
            catch (e) {
                this.logger.error(`Error processing RTP packet: ${e.message}`);
            }
        });
        this.socket.on('error', (err) => {
            this.logger.error(`UDP socket error on port ${this.port}: ${err.message}`);
        });
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        this.eventEmitter.removeAllListeners();
        try {
            this.socket.close();
        }
        catch {
            // Socket may already be closed
        }
        this.logger.log(`RTP session closed on port ${this.port}`);
    }
}
exports.RtpSession = RtpSession;
/**
 * RTP UDP Server Service.
 *
 * Creates ephemeral UDP sockets for each Voice Robot call session.
 * Each session gets its own port and emits decoded audio events
 * for VAD and STT processing.
 */
let RtpUdpServerService = RtpUdpServerService_1 = class RtpUdpServerService {
    audioService;
    configService;
    logger = new common_1.Logger(RtpUdpServerService_1.name);
    activeSessions = new Map();
    minPort;
    maxPort;
    currentPort;
    constructor(audioService, configService) {
        this.audioService = audioService;
        this.configService = configService;
        const minStr = this.configService.get('RTP_MIN_PORT');
        const maxStr = this.configService.get('RTP_MAX_PORT');
        this.minPort = minStr ? parseInt(minStr, 10) : 0;
        this.maxPort = maxStr ? parseInt(maxStr, 10) : 0;
        this.currentPort = this.minPort;
    }
    getNextPort() {
        if (this.minPort === 0 || this.maxPort === 0 || this.minPort > this.maxPort) {
            return 0; // OS assigns an ephemeral port
        }
        // Try finding an available port in the range
        for (let i = 0; i <= (this.maxPort - this.minPort); i++) {
            const port = this.currentPort;
            this.currentPort++;
            if (this.currentPort > this.maxPort) {
                this.currentPort = this.minPort;
            }
            if (!this.activeSessions.has(port)) {
                return port;
            }
        }
        throw new Error('No available RTP ports in configured range');
    }
    /**
     * Create a new RTP session with an ephemeral UDP port.
     *
     * @returns RtpSession with port number and audio event emitter
     */
    async createSession() {
        return new Promise((resolve, reject) => {
            const socket = dgram.createSocket('udp4');
            socket.on('listening', () => {
                socket.removeAllListeners('error'); // remove setup error handler
                // Add permanent runtime error handler
                socket.on('error', (err) => {
                    this.logger.error(`UDP socket runtime error: ${err.message}`);
                });
                const addr = socket.address();
                const port = addr.port;
                const session = new RtpSession(this.audioService, socket, port);
                this.activeSessions.set(port, session);
                this.logger.log(`RTP session created on port ${port}`);
                resolve(session);
            });
            const attemptBind = (attempts) => {
                if (attempts > 50) {
                    return reject(new Error('Failed to bind UDP socket after 50 attempts'));
                }
                try {
                    const portToBind = this.getNextPort();
                    socket.once('error', (err) => {
                        if (err.code === 'EADDRINUSE' && portToBind !== 0) {
                            this.logger.warn(`Port ${portToBind} in use, trying next...`);
                            attemptBind(attempts + 1);
                        }
                        else {
                            this.logger.error(`Failed to bind UDP socket: ${err.message}`);
                            reject(err);
                        }
                    });
                    socket.bind(portToBind);
                }
                catch (e) {
                    reject(e);
                }
            };
            attemptBind(0);
        });
    }
    /**
     * Close a specific RTP session by port.
     */
    closeSession(port) {
        const session = this.activeSessions.get(port);
        if (session) {
            session.close();
            this.activeSessions.delete(port);
        }
    }
    /**
     * Get count of active sessions (for monitoring).
     */
    getActiveSessionCount() {
        return this.activeSessions.size;
    }
    onModuleDestroy() {
        this.logger.log(`Shutting down ${this.activeSessions.size} RTP sessions...`);
        for (const [port, session] of this.activeSessions) {
            session.close();
        }
        this.activeSessions.clear();
    }
};
exports.RtpUdpServerService = RtpUdpServerService;
exports.RtpUdpServerService = RtpUdpServerService = RtpUdpServerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audio_service_1.AudioService,
        config_1.ConfigService])
], RtpUdpServerService);
//# sourceMappingURL=rtp-udp-server.service.js.map