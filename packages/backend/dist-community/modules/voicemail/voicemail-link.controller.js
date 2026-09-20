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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoicemailLinkController = void 0;
const common_1 = require("@nestjs/common");
const voicemail_link_guard_1 = require("./voicemail-link.guard");
const voicemail_service_1 = require("./voicemail.service");
/**
 * Token-only play route (D-59). No JwtAuthGuard — VoicemailLinkGuard is the sole auth.
 * Do not route through cdr-public.controller.
 */
let VoicemailLinkController = class VoicemailLinkController {
    service;
    constructor(service) {
        this.service = service;
    }
    play(req, res, token) {
        return this.service.streamByPlayToken(token, req.user.vpbx_user_uid, req, res);
    }
};
exports.VoicemailLinkController = VoicemailLinkController;
__decorate([
    (0, common_1.Get)('play'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], VoicemailLinkController.prototype, "play", null);
exports.VoicemailLinkController = VoicemailLinkController = __decorate([
    (0, common_1.UseGuards)(voicemail_link_guard_1.VoicemailLinkGuard),
    (0, common_1.Controller)('voicemail'),
    __metadata("design:paramtypes", [voicemail_service_1.VoicemailService])
], VoicemailLinkController);
//# sourceMappingURL=voicemail-link.controller.js.map