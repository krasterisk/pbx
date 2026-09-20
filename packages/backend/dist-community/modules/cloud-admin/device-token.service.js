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
var DeviceTokenService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEVICE_TOKEN_MAX_LENGTH = exports.DeviceTokenService = void 0;
exports.assertValidDeviceToken = assertValidDeviceToken;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const device_token_model_1 = require("./models/device-token.model");
const tenants_service_1 = require("./tenants.service");
/**
 * Persists FCM device tokens per user+tenant (D-32).
 * Never logs token values (T-08-19).
 */
let DeviceTokenService = DeviceTokenService_1 = class DeviceTokenService {
    deviceTokenModel;
    tenantsService;
    logger = new common_1.Logger(DeviceTokenService_1.name);
    constructor(deviceTokenModel, tenantsService) {
        this.deviceTokenModel = deviceTokenModel;
        this.tenantsService = tenantsService;
    }
    async upsertForUser(input) {
        const tenantId = await this.resolveTenantId(input);
        const platform = input.platform != null && input.platform.trim() !== ''
            ? input.platform.trim().slice(0, 32)
            : null;
        const [row] = await this.deviceTokenModel.upsert({
            user_uid: input.userUid,
            tenant_id: tenantId,
            token: input.token,
            platform,
        });
        this.logger.log(`Device token upserted for user=${input.userUid} tenant=${tenantId} platform=${platform ?? 'n/a'}`);
        return row;
    }
    async resolveTenantId(input) {
        if (input.tenantId != null && Number.isFinite(input.tenantId)) {
            return input.tenantId;
        }
        // JWT carries vpbx_user_uid, not tenants.id — resolve cloud tenant when present.
        const vpbxCandidates = [input.vpbxUserUid, input.userUid].filter((id) => id != null && Number.isFinite(id) && id > 0);
        for (const vpbx of vpbxCandidates) {
            const tenant = await this.tenantsService.findByVpbxUid(vpbx);
            if (tenant?.id != null) {
                return tenant.id;
            }
        }
        // Local / legacy installs often have no `tenants` row (SUPERADMIN, single-PBX).
        // Partition by vpbx_user_uid the same way billing does when tenants.id is absent.
        const partitionKey = vpbxCandidates[0];
        if (partitionKey != null) {
            this.logger.warn(`No tenants row for user=${input.userUid}; using vpbx partition ${partitionKey} for device token`);
            return partitionKey;
        }
        throw new common_1.ForbiddenException('Tenant binding required to register device token');
    }
};
exports.DeviceTokenService = DeviceTokenService;
exports.DeviceTokenService = DeviceTokenService = DeviceTokenService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(device_token_model_1.DeviceToken)),
    __metadata("design:paramtypes", [Object, tenants_service_1.TenantsService])
], DeviceTokenService);
/** Max FCM token length (T-08-18). */
exports.DEVICE_TOKEN_MAX_LENGTH = 4096;
function assertValidDeviceToken(token) {
    if (!token) {
        throw new common_1.BadRequestException('token is required');
    }
    if (token.length > exports.DEVICE_TOKEN_MAX_LENGTH) {
        throw new common_1.BadRequestException(`token must be at most ${exports.DEVICE_TOKEN_MAX_LENGTH} characters`);
    }
}
//# sourceMappingURL=device-token.service.js.map