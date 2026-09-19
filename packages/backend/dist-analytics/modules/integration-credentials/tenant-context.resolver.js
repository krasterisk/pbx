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
exports.TenantContextResolver = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const user_model_1 = require("../users/user.model");
const tenant_model_1 = require("../cloud-admin/tenant.model");
/** Re-reads current SQL identity; a signed but stale JWT is not authorization. */
let TenantContextResolver = class TenantContextResolver {
    users;
    tenants;
    constructor(users, tenants) {
        this.users = users;
        this.tenants = tenants;
    }
    async fromUserClaims(claims, requestId, now = new Date()) {
        if (!claims || !Number.isSafeInteger(claims.sub) || claims.sub <= 0
            || !Number.isSafeInteger(claims.vpbx_user_uid) || claims.vpbx_user_uid < 0
            || !Number.isSafeInteger(claims.level) || !Number.isSafeInteger(claims.role)
            || !Number.isSafeInteger(claims.iat) || claims.iat <= 0) {
            throw new common_1.UnauthorizedException({ code: 'identity_invalid' });
        }
        // Platform operations use their own audited target resolver; no universal
        // superadmin bypass is available for a product tenant context.
        if (claims.level === user_model_1.UserLevel.SUPERADMIN) {
            throw new common_1.ForbiddenException({ code: 'platform_target_required' });
        }
        const user = await this.users.findOne({
            where: { uniqueid: claims.sub },
            attributes: [
                'uniqueid', 'level', 'role', 'vpbx_user_uid', 'isActivated',
                'activationCode', 'updatedAt',
            ],
        });
        if (!user || user.level !== claims.level || (user.role ?? 0) !== claims.role
            || user.vpbx_user_uid !== claims.vpbx_user_uid
            || (!user.isActivated && !!user.activationCode)) {
            throw new common_1.UnauthorizedException({ code: 'identity_revoked' });
        }
        const updatedAt = new Date(user.updatedAt).getTime();
        // JWT iat has second precision. Current membership and role are checked
        // exactly; this timestamp additionally revokes tokens after later updates.
        if (!Number.isFinite(updatedAt) || updatedAt >= (claims.iat + 1) * 1000) {
            throw new common_1.UnauthorizedException({ code: 'identity_revoked' });
        }
        const tenant = await this.tenants.findOne({
            where: { vpbx_user_uid: claims.vpbx_user_uid },
            attributes: ['vpbx_user_uid', 'status', 'trial_ends_at'],
        });
        if (!tenant || tenant.status === 'suspended' || tenant.status === 'cancelled'
            || (tenant.status === 'trial' && (!tenant.trial_ends_at
                || new Date(tenant.trial_ends_at).getTime() <= now.getTime()))) {
            throw new common_1.ForbiddenException({ code: 'tenant_inactive' });
        }
        return Object.freeze({
            tenantUid: tenant.vpbx_user_uid,
            principalId: `user:${user.uniqueid}`,
            principalKind: 'user',
            permissionRevision: `${updatedAt}:${user.level}:${user.role ?? 0}:${tenant.status}`,
            requestId,
        });
    }
};
exports.TenantContextResolver = TenantContextResolver;
exports.TenantContextResolver = TenantContextResolver = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __param(1, (0, sequelize_1.InjectModel)(tenant_model_1.Tenant)),
    __metadata("design:paramtypes", [Object, Object])
], TenantContextResolver);
//# sourceMappingURL=tenant-context.resolver.js.map