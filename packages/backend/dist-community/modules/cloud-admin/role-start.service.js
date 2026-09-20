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
exports.RoleStartService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const user_model_1 = require("../users/user.model");
const role_start_model_1 = require("./models/role-start.model");
const OVERVIEW = '/';
const CC_AGENT = '/callcenter/agent';
const CC_SUPERVISOR = '/callcenter/supervisor';
function hardcodedDefault(level) {
    switch (level) {
        case user_model_1.UserLevel.OPERATOR:
            return CC_AGENT;
        case user_model_1.UserLevel.SUPERVISOR:
            return CC_SUPERVISOR;
        case user_model_1.UserLevel.ADMIN:
        case user_model_1.UserLevel.SUPERADMIN:
        case user_model_1.UserLevel.READONLY:
        default:
            return OVERVIEW;
    }
}
function isCallCenterPath(path) {
    return path.startsWith('/callcenter/');
}
let RoleStartService = class RoleStartService {
    defaultsModel;
    tenantModel;
    constructor(defaultsModel, tenantModel) {
        this.defaultsModel = defaultsModel;
        this.tenantModel = tenantModel;
    }
    /**
     * Resolve start path: tenant override → platform default → D-16 hardcoded.
     * CC-off still falls back to Overview for CC paths (D-16).
     */
    async resolveStart(level, tenantId, tenantModuleState = {}) {
        const callCenterEnabled = tenantModuleState.callCenterEnabled !== false;
        let path = null;
        if (tenantId != null && level != null) {
            const override = await this.tenantModel.findOne({
                where: { tenant_id: tenantId, user_level: level },
            });
            if (override?.start_path)
                path = override.start_path;
        }
        if (!path && level != null) {
            const def = await this.defaultsModel.findOne({ where: { user_level: level } });
            if (def?.start_path)
                path = def.start_path;
        }
        if (!path)
            path = hardcodedDefault(level);
        if (!callCenterEnabled && isCallCenterPath(path)) {
            return OVERVIEW;
        }
        return path;
    }
    async listDefaults() {
        return this.defaultsModel.findAll({ order: [['user_level', 'ASC']] });
    }
    async listTenantOverrides(tenantId) {
        return this.tenantModel.findAll({
            where: { tenant_id: tenantId },
            order: [['user_level', 'ASC']],
        });
    }
    /** Platform SuperAdmin writes role_start_defaults (D-04). */
    async upsertDefaults(rows) {
        for (const row of rows) {
            await this.defaultsModel.upsert({
                user_level: row.user_level,
                start_path: row.start_path,
            });
        }
        return this.listDefaults();
    }
    /**
     * Tenant ADMIN writes tenant_role_start for own tenant only (D-04).
     * Never accept a different tenant_id from the client body.
     */
    async upsertTenantOverrides(tenantId, rows) {
        for (const row of rows) {
            await this.tenantModel.upsert({
                tenant_id: tenantId,
                user_level: row.user_level,
                start_path: row.start_path,
            });
        }
        return this.listTenantOverrides(tenantId);
    }
};
exports.RoleStartService = RoleStartService;
exports.RoleStartService = RoleStartService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(role_start_model_1.RoleStartDefault)),
    __param(1, (0, sequelize_1.InjectModel)(role_start_model_1.TenantRoleStart)),
    __metadata("design:paramtypes", [Object, Object])
], RoleStartService);
//# sourceMappingURL=role-start.service.js.map