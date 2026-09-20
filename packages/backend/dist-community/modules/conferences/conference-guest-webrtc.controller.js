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
exports.ConferenceGuestWebrtcController = void 0;
const common_1 = require("@nestjs/common");
const conference_guest_token_guard_1 = require("./conference-guest-token.guard");
const DEFAULT_STUN = 'stun:stun.l.google.com:19302';
/**
 * Guest ICE/WSS config — same payload as GET /callcenter/webrtc/config,
 * gated by the opaque guest token instead of JWT (D-23/D-24, T-16.1-10).
 * SIP password is never returned here.
 */
let ConferenceGuestWebrtcController = class ConferenceGuestWebrtcController {
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
            iceServers.push({
                urls: turnUrl,
                username: process.env.WEBRTC_TURN_USERNAME,
                credential: process.env.WEBRTC_TURN_PASSWORD,
            });
        }
        return { wssUrl, iceServers };
    }
};
exports.ConferenceGuestWebrtcController = ConferenceGuestWebrtcController;
__decorate([
    (0, common_1.UseGuards)(conference_guest_token_guard_1.ConferenceGuestTokenGuard),
    (0, common_1.Get)(':token/webrtc-config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], ConferenceGuestWebrtcController.prototype, "getConfig", null);
exports.ConferenceGuestWebrtcController = ConferenceGuestWebrtcController = __decorate([
    (0, common_1.Controller)('conferences/guest')
], ConferenceGuestWebrtcController);
//# sourceMappingURL=conference-guest-webrtc.controller.js.map