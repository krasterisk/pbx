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
var CallCenterMediaBridgeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CC_AI_VOICE_MODULE = exports.CallCenterMediaBridgeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ari_http_client_service_1 = require("../ari/ari-http-client.service");
const rtp_udp_server_service_1 = require("../voice-robots/services/rtp-udp-server.service");
const modules_registry_service_1 = require("../cloud-admin/modules-registry.service");
const callcenter_state_service_1 = require("./callcenter-state.service");
const CC_AI_VOICE_MODULE = 'cc_ai_voice';
exports.CC_AI_VOICE_MODULE = CC_AI_VOICE_MODULE;
/**
 * CallCenterMediaBridgeService — ARI externalMedia PCM skeleton (D-41c).
 *
 * Reuses voice-robots RTP pipeline (RtpUdpServerService + AriHttpClientService.externalMedia)
 * and emits `media.pcmFrame` into the typed CC event bus. NO STT/VAD (D-42/D-44).
 *
 * Inert by design: never auto-subscribes to StasisStart — paid AI modules call
 * attachPcmSkeleton when licensed. License-gate via ModulesRegistryService (D-43).
 */
let CallCenterMediaBridgeService = CallCenterMediaBridgeService_1 = class CallCenterMediaBridgeService {
    ariClient;
    udpServer;
    stateService;
    modulesRegistry;
    configService;
    logger = new common_1.Logger(CallCenterMediaBridgeService_1.name);
    attachments = new Map();
    externalHost;
    constructor(ariClient, udpServer, stateService, modulesRegistry, configService) {
        this.ariClient = ariClient;
        this.udpServer = udpServer;
        this.stateService = stateService;
        this.modulesRegistry = modulesRegistry;
        this.configService = configService;
        this.externalHost = this.configService.get('EXTERNAL_RTP_HOST', '127.0.0.1');
    }
    /**
     * Attach PCM skeleton to a live call channel.
     * No-ops when tenant lacks `cc_ai_voice` license (D-43).
     * Idempotent for the same channelId (re-attach detaches first).
     */
    async attachPcmSkeleton(channelId, callUniqueid, vpbxUserUid) {
        const licensed = await this.modulesRegistry.tenantHasModule(vpbxUserUid, CC_AI_VOICE_MODULE);
        if (!licensed) {
            this.logger.log(`attachPcmSkeleton no-op: tenant ${vpbxUserUid} lacks module ${CC_AI_VOICE_MODULE}`);
            return { attached: false, reason: 'module_not_licensed' };
        }
        if (this.attachments.has(channelId)) {
            await this.detachPcmSkeleton(channelId);
        }
        // Format `alaw` matches RtpSession decode path (voice-robots); plan mentioned slin16
        // but existing RTP decoder always decodes A-law → PCM16.
        const session = await this.udpServer.createSession();
        const appName = this.ariClient.getAppName();
        const externalChannel = await this.ariClient.externalMedia(null, appName, `${this.externalHost}:${session.port}`, 'alaw', channelId);
        const onPcm = (frame) => {
            this.stateService.emitEvent('media.pcmFrame', vpbxUserUid, {
                channelId,
                callUniqueid,
                frame,
            });
        };
        session.eventEmitter.on('audio-pcm16', onPcm);
        this.attachments.set(channelId, {
            port: session.port,
            externalChannelId: externalChannel.id,
            callUniqueid,
            vpbxUserUid,
            onPcm,
        });
        this.logger.log(`PCM skeleton attached: channel=${channelId} call=${callUniqueid} port=${session.port}`);
        return { attached: true };
    }
    /**
     * Idempotent detach — closes RTP session and hangs up externalMedia channel.
     */
    async detachPcmSkeleton(channelId) {
        const attachment = this.attachments.get(channelId);
        if (!attachment)
            return;
        this.attachments.delete(channelId);
        try {
            this.udpServer.closeSession(attachment.port);
        }
        catch (e) {
            this.logger.warn(`closeSession(${attachment.port}) failed: ${e?.message || e}`);
        }
        try {
            await this.ariClient.hangupChannel(attachment.externalChannelId);
        }
        catch (e) {
            this.logger.warn(`hangup external ${attachment.externalChannelId} failed: ${e?.message || e}`);
        }
        this.logger.log(`PCM skeleton detached: channel=${channelId}`);
    }
};
exports.CallCenterMediaBridgeService = CallCenterMediaBridgeService;
exports.CallCenterMediaBridgeService = CallCenterMediaBridgeService = CallCenterMediaBridgeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ari_http_client_service_1.AriHttpClientService,
        rtp_udp_server_service_1.RtpUdpServerService,
        callcenter_state_service_1.CallCenterStateService,
        modules_registry_service_1.ModulesRegistryService,
        config_1.ConfigService])
], CallCenterMediaBridgeService);
//# sourceMappingURL=callcenter-media-bridge.service.js.map