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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterWebrtcController = void 0;
/**
 * WebRTC softphone runtime config (D-17).
 *
 * GET /callcenter/webrtc/config — WSS URL + ICE servers (STUN always, TURN optional from env).
 * TURN credentials stay server-side and are returned only per authenticated request;
 * they must never be inlined into the frontend bundle.
 *
 * Env (read at request time):
 * - ASTERISK_WSS_URL — e.g. wss://pbx.example.com:8089/ws.
 *   When unset/empty, `wssUrl` is null — agent UI must treat this as a config failure
 *   (REGISTER cannot proceed). Ops must set this to the live Asterisk PJSIP WebSocket.
 * - WEBRTC_STUN_SERVERS — comma-separated STUN URLs (default stun:stun.l.google.com:19302)
 * - WEBRTC_TURN_URL / WEBRTC_TURN_USERNAME / WEBRTC_TURN_PASSWORD — optional TURN
 *
 * Note: SIP_DOMAIN is used by endpoints credentials (SIP domain for REGISTER auth),
 * not returned by this endpoint. See EndpointsService getCredentials.
 */
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const DEFAULT_STUN = 'stun:stun.l.google.com:19302';
let CallCenterWebrtcController = class CallCenterWebrtcController {
    getConfig() {
        const wssUrl = process.env.ASTERISK_WSS_URL?.trim() || null;
        const stunRaw = process.env.WEBRTC_STUN_SERVERS?.trim() || DEFAULT_STUN;
        const stunUrls = stunRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        const iceServers = [
            { urls: stunUrls.length === 1 ? stunUrls[0] : stunUrls },
        ];
        const turnUrl = process.env.WEBRTC_TURN_URL?.trim();
        if (turnUrl) {
            // Do not log username/credential (Information Disclosure — T-07-14-02)
            iceServers.push({
                urls: turnUrl,
                username: process.env.WEBRTC_TURN_USERNAME,
                credential: process.env.WEBRTC_TURN_PASSWORD,
            });
        }
        return { wssUrl, iceServers };
    }
};
exports.CallCenterWebrtcController = CallCenterWebrtcController;
__decorate([
    (0, common_1.Get)('config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], CallCenterWebrtcController.prototype, "getConfig", null);
exports.CallCenterWebrtcController = CallCenterWebrtcController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('callcenter/webrtc')
], CallCenterWebrtcController);
//# sourceMappingURL=callcenter-webrtc.controller.js.map