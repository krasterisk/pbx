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
exports.CallCenterPermissionsService = exports.SAFE_DEFAULT_PERMISSIONS = void 0;
exports.withClickToCallRoleSeed = withClickToCallRoleSeed;
/**
 * Server-authoritative granular-permission resolver (D-38/D-39).
 *
 * Single place every downstream capability (peer ChanSpy, click-to-call, customize_ui)
 * consults for the *effective* right: role default (`cc_settings.role_permission_defaults`,
 * keyed by the operator's UserLevel) overlaid by the per-operator override
 * (`cc_operator_settings`), unless the tenant lock for that right is set — a locked
 * right always resolves to the role default, ignoring any operator column value (D-06).
 *
 * Never trust a client-sent permission flag — effective rights are always resolved here,
 * from the DB, server-side.
 */
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const operator_settings_model_1 = require("./models/operator-settings.model");
const cc_settings_model_1 = require("./models/cc-settings.model");
const user_model_1 = require("../users/user.model");
const BOOLEAN_RIGHTS = ['can_spy', 'spyable', 'click_to_call', 'customize_ui'];
/** Missing operator row AND missing role default → these hardcoded safe defaults apply. */
exports.SAFE_DEFAULT_PERMISSIONS = {
    can_spy: false,
    spyable: true,
    spy_modes: ['listen'],
    click_to_call: false,
    customize_ui: false,
};
/**
 * D-40 / dual-mode softphone: SIP dialpad needs click_to_call (AMI Originate).
 * Seed OPERATOR + SUPERVISOR role defaults with click_to_call:true only when the
 * key is absent — never overwrite an explicit false set by an admin.
 */
function withClickToCallRoleSeed(defaults) {
    const out = { ...(defaults ?? {}) };
    for (const level of [user_model_1.UserLevel.OPERATOR, user_model_1.UserLevel.SUPERVISOR]) {
        const entry = { ...(out[level] ?? {}) };
        if (!Object.prototype.hasOwnProperty.call(entry, 'click_to_call')) {
            entry.click_to_call = true;
            out[level] = entry;
        }
    }
    return out;
}
let CallCenterPermissionsService = class CallCenterPermissionsService {
    operatorSettingsModel;
    ccSettingsModel;
    userModel;
    constructor(operatorSettingsModel, ccSettingsModel, userModel) {
        this.operatorSettingsModel = operatorSettingsModel;
        this.ccSettingsModel = ccSettingsModel;
        this.userModel = userModel;
    }
    /**
     * Resolves the effective PermissionSet for one operator.
     * Missing operator row → pure role default. Missing role default → SAFE_DEFAULT_PERMISSIONS.
     * A locked right always resolves to the role default, regardless of the operator column value.
     */
    async getEffective(userUid, operatorUserId) {
        const operatorUser = await this.userModel.findOne({
            where: { uniqueid: operatorUserId, vpbx_user_uid: userUid },
        });
        const level = operatorUser?.getDataValue('level') ?? undefined;
        const tenantSettings = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
        const roleDefaultsMap = withClickToCallRoleSeed(tenantSettings?.role_permission_defaults);
        const roleDefault = (level != null && roleDefaultsMap[level]) || {};
        const locks = (level != null && tenantSettings?.permission_locks?.[level]) || {};
        const operatorRow = await this.operatorSettingsModel.findOne({
            where: { user_uid: userUid, operator_user_id: operatorUserId },
        });
        const result = {};
        for (const right of BOOLEAN_RIGHTS) {
            const roleValue = roleDefault[right] ?? exports.SAFE_DEFAULT_PERMISSIONS[right];
            if (locks[right]) {
                result[right] = roleValue;
                continue;
            }
            result[right] = operatorRow ? operatorRow.getDataValue(right) : roleValue;
        }
        const roleSpyModes = roleDefault.spy_modes ?? exports.SAFE_DEFAULT_PERMISSIONS.spy_modes;
        result.spy_modes = locks.spy_modes
            ? roleSpyModes
            : operatorRow
                ? operatorRow.getDataValue('spy_modes') ?? roleSpyModes
                : roleSpyModes;
        return result;
    }
    /** Throws ForbiddenException when the effective boolean right is false. */
    async assert(userUid, operatorUserId, right) {
        const perms = await this.getEffective(userUid, operatorUserId);
        if (!perms[right]) {
            throw new common_1.ForbiddenException(`${right} not granted`);
        }
        return perms;
    }
    /** Throws ForbiddenException when `mode` is not in the operator's effective spy_modes. */
    async assertSpyMode(userUid, operatorUserId, mode) {
        const perms = await this.getEffective(userUid, operatorUserId);
        if (!perms.spy_modes.includes(mode)) {
            throw new common_1.ForbiddenException(`Mode ${mode} not granted`);
        }
        return perms;
    }
};
exports.CallCenterPermissionsService = CallCenterPermissionsService;
exports.CallCenterPermissionsService = CallCenterPermissionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(operator_settings_model_1.CcOperatorSettings)),
    __param(1, (0, sequelize_1.InjectModel)(cc_settings_model_1.CcSettings)),
    __param(2, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __metadata("design:paramtypes", [Object, Object, Object])
], CallCenterPermissionsService);
//# sourceMappingURL=callcenter-permissions.service.js.map