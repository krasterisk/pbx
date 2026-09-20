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
var JwtOrServiceTokenGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtOrServiceTokenGuard = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
/**
 * JwtOrServiceTokenGuard — accepts either a valid user JWT or a service token.
 *
 * Priority:
 *   1. Try JWT (Passport 'jwt' strategy) — regular user requests
 *   2. On JWT failure, try ServiceToken — aiPBX webhook calls
 *
 * This allows all existing endpoints to continue working for users
 * while also accepting aiPBX service calls without any code changes.
 */
let JwtOrServiceTokenGuard = JwtOrServiceTokenGuard_1 = class JwtOrServiceTokenGuard {
    config;
    logger = new common_1.Logger(JwtOrServiceTokenGuard_1.name);
    jwtGuard = new (class extends (0, passport_1.AuthGuard)('jwt') {
    })();
    constructor(config) {
        this.config = config;
    }
    async canActivate(context) {
        // 1. Try JWT first
        try {
            const jwtResult = await this.jwtGuard.canActivate(context);
            if (jwtResult)
                return true;
        }
        catch {
            // JWT failed — fall through to service token
        }
        // 2. Try service token
        const request = context.switchToHttp().getRequest();
        const serviceToken = this.config.get('KRASTERISK_SERVICE_TOKEN');
        if (!serviceToken) {
            throw new common_1.UnauthorizedException('Not authenticated');
        }
        const authHeader = request.headers['authorization'];
        if (!authHeader?.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Not authenticated');
        }
        const providedToken = authHeader.slice(7).trim();
        if (providedToken !== serviceToken) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const tenantUidHeader = request.headers['x-vpbx-user-uid'];
        const vpbxUserUid = tenantUidHeader ? parseInt(String(tenantUidHeader), 10) : 0;
        if (!vpbxUserUid || isNaN(vpbxUserUid)) {
            throw new common_1.UnauthorizedException('X-Vpbx-User-Uid header is required');
        }
        request.user = {
            sub: 0,
            login: 'service-account',
            name: 'aiPBX Service',
            level: 'admin',
            role: 0,
            vpbx_user_uid: vpbxUserUid,
        };
        this.logger.debug(`Service token auth OK for tenant ${vpbxUserUid}`);
        return true;
    }
};
exports.JwtOrServiceTokenGuard = JwtOrServiceTokenGuard;
exports.JwtOrServiceTokenGuard = JwtOrServiceTokenGuard = JwtOrServiceTokenGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], JwtOrServiceTokenGuard);
//# sourceMappingURL=jwt-or-service-token.guard.js.map