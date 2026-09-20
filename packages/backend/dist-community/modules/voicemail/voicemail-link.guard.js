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
exports.VoicemailLinkGuard = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const voicemail_access_token_model_1 = require("./voicemail-access-token.model");
/**
 * VoicemailLinkGuard — validates opaque play tokens for GET /voicemail/play (D-59 / D-67).
 *
 * Separate auth branch from JwtAuthGuard: reads ?token= query param, looks up
 * vm_access_tokens, rejects missing/unknown/revoked/expired rows.
 *
 * Pitfall 5: req.user is set WITHOUT level/sub so a leaked play token cannot
 * silently escalate if it ever hits a JWT-guarded endpoint.
 */
let VoicemailLinkGuard = class VoicemailLinkGuard {
    tokenModel;
    constructor(tokenModel) {
        this.tokenModel = tokenModel;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const token = req.query?.token;
        if (!token || typeof token !== 'string') {
            throw new common_1.UnauthorizedException('Voicemail token required');
        }
        const row = await this.tokenModel.findOne({ where: { token } });
        if (!row) {
            throw new common_1.UnauthorizedException('Voicemail token invalid');
        }
        if (row.revoked_at != null) {
            throw new common_1.UnauthorizedException('Voicemail token revoked');
        }
        if (row.expires_at != null && row.expires_at < new Date()) {
            throw new common_1.UnauthorizedException('Voicemail token expired');
        }
        req.user = {
            vpbx_user_uid: row.vpbx_user_uid,
            isDisplayToken: true,
        };
        return true;
    }
};
exports.VoicemailLinkGuard = VoicemailLinkGuard;
exports.VoicemailLinkGuard = VoicemailLinkGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(voicemail_access_token_model_1.VoicemailAccessToken)),
    __metadata("design:paramtypes", [Object])
], VoicemailLinkGuard);
//# sourceMappingURL=voicemail-link.guard.js.map