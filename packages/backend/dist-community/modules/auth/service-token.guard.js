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
var ServiceTokenGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceTokenGuard = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
/**
 * ServiceTokenGuard — authenticates requests from aiPBX webhook tool calls.
 *
 * Validates `Authorization: Bearer <KRASTERISK_SERVICE_TOKEN>` header.
 * Tenant identity is provided via `X-Vpbx-User-Uid` header.
 *
 * Sets req.user compatible with JwtPayloadUser so all existing service
 * methods that use req.user.vpbx_user_uid work transparently.
 *
 * Usage:
 *   @UseGuards(JwtOrServiceTokenGuard)  ← preferred (allows both)
 *   @UseGuards(ServiceTokenGuard)       ← service-only endpoints
 */
let ServiceTokenGuard = ServiceTokenGuard_1 = class ServiceTokenGuard {
    config;
    logger = new common_1.Logger(ServiceTokenGuard_1.name);
    constructor(config) {
        this.config = config;
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const serviceToken = this.config.get('KRASTERISK_SERVICE_TOKEN');
        if (!serviceToken) {
            this.logger.warn('KRASTERISK_SERVICE_TOKEN is not configured — service token auth disabled');
            throw new common_1.UnauthorizedException('Service token authentication is not configured');
        }
        const authHeader = request.headers['authorization'];
        if (!authHeader?.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Missing or malformed Authorization header');
        }
        const providedToken = authHeader.slice(7).trim();
        if (providedToken !== serviceToken) {
            this.logger.warn(`Invalid service token from ${request.ip}`);
            throw new common_1.UnauthorizedException('Invalid service token');
        }
        // Read tenant UID from header — aiPBX sets this per-chat
        const tenantUidHeader = request.headers['x-vpbx-user-uid'];
        const vpbxUserUid = tenantUidHeader ? parseInt(String(tenantUidHeader), 10) : 0;
        if (!vpbxUserUid || isNaN(vpbxUserUid)) {
            throw new common_1.UnauthorizedException('X-Vpbx-User-Uid header is required for service token auth');
        }
        // Inject synthetic user compatible with JwtPayloadUser
        request.user = {
            sub: 0,
            login: 'service-account',
            name: 'aiPBX Service',
            level: 'admin',
            role: 0,
            vpbx_user_uid: vpbxUserUid,
        };
        return true;
    }
};
exports.ServiceTokenGuard = ServiceTokenGuard;
exports.ServiceTokenGuard = ServiceTokenGuard = ServiceTokenGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ServiceTokenGuard);
//# sourceMappingURL=service-token.guard.js.map