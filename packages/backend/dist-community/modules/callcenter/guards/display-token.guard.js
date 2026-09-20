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
exports.DisplayTokenGuard = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const display_token_model_1 = require("../models/display-token.model");
/**
 * DisplayTokenGuard — validates opaque display tokens for TV wallboard SSE (D-26).
 *
 * Separate auth branch from JwtAuthGuard: reads ?token= query param, looks up
 * cc_display_tokens, rejects revoked/expired rows.
 *
 * Pitfall 5: req.user is set WITHOUT level/sub so a leaked display token cannot
 * silently escalate if it ever hits a JWT-guarded endpoint.
 */
let DisplayTokenGuard = class DisplayTokenGuard {
    displayTokenModel;
    constructor(displayTokenModel) {
        this.displayTokenModel = displayTokenModel;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const token = req.query?.token;
        if (!token || typeof token !== 'string') {
            throw new common_1.UnauthorizedException('Display token required');
        }
        const row = await this.displayTokenModel.findOne({ where: { token } });
        if (!row) {
            throw new common_1.UnauthorizedException('Display token invalid');
        }
        if (row.revoked_at != null) {
            throw new common_1.UnauthorizedException('Display token revoked');
        }
        if (row.expires_at != null && row.expires_at < new Date()) {
            throw new common_1.UnauthorizedException('Display token expired');
        }
        // Intentionally omit level/sub — display tokens must never impersonate a user
        req.user = {
            vpbx_user_uid: row.user_uid,
            isDisplayToken: true,
        };
        // Fire-and-forget audit stamp — do not await SSE connect
        row.update({ last_used_at: new Date() }).catch(() => undefined);
        return true;
    }
};
exports.DisplayTokenGuard = DisplayTokenGuard;
exports.DisplayTokenGuard = DisplayTokenGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(display_token_model_1.CcDisplayToken)),
    __metadata("design:paramtypes", [Object])
], DisplayTokenGuard);
//# sourceMappingURL=display-token.guard.js.map