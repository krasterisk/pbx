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
exports.DeviceTokenController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const device_token_service_1 = require("./device-token.service");
/**
 * Device token registration for Capacitor Push (D-32).
 * JWT-bound upsert — no campaign UX.
 */
let DeviceTokenController = class DeviceTokenController {
    deviceTokenService;
    constructor(deviceTokenService) {
        this.deviceTokenService = deviceTokenService;
    }
    async register(body, req) {
        const userUid = req?.user?.sub ?? req?.user?.uniqueid;
        if (!req?.user || userUid == null) {
            throw new common_1.UnauthorizedException('Authentication required to register device token');
        }
        const token = typeof body?.token === 'string' ? body.token.trim() : '';
        (0, device_token_service_1.assertValidDeviceToken)(token);
        if (body.platform != null && typeof body.platform !== 'string') {
            throw new common_1.BadRequestException('platform must be a string when provided');
        }
        await this.deviceTokenService.upsertForUser({
            userUid,
            tenantId: req.user.tenant_id,
            vpbxUserUid: req.user.vpbx_user_uid,
            token,
            platform: body.platform,
        });
        return { ok: true };
    }
};
exports.DeviceTokenController = DeviceTokenController;
__decorate([
    (0, common_1.Post)('device-token'),
    (0, swagger_1.ApiOperation)({ summary: 'Register FCM/device push token for current user' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DeviceTokenController.prototype, "register", null);
exports.DeviceTokenController = DeviceTokenController = __decorate([
    (0, swagger_1.ApiTags)('Marketplace'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('marketplace'),
    __metadata("design:paramtypes", [device_token_service_1.DeviceTokenService])
], DeviceTokenController);
//# sourceMappingURL=device-token.controller.js.map