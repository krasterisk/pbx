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
exports.CallCenterSettingsController = void 0;
/**
 * Call Center settings REST API.
 *
 * RBAC:
 * - Operator (own): GET/PUT /operator — id from req.user.sub (IDOR mitigation T-07-05-01)
 * - Supervisor: GET/PUT /operator/:operatorId — own tenant only (T-07-05-03)
 * - Tenant singleton: GET open to tenant auth; PUT requires assertSupervisor (T-07-05-02)
 *
 * D-05/D-06/D-38...D-43 (09-13): the same self/:operatorId/tenant split extends to
 * UI customization, granular permissions and the notification matrix — one controller,
 * one IDOR-mitigation pattern (T-09-13-01). Every write derives the operator id from the
 * JWT for self routes; :operatorId/tenant routes are supervisor-gated (T-09-13-02/03).
 *
 * Route ordering note: exact-path self routes (`operator/ui`, `operator/permissions`,
 * `operator/notifications`) MUST be registered before the `operator/:operatorId`
 * wildcard, or Nest/Express would match e.g. `GET operator/ui` against the wildcard
 * (treating "ui" as `operatorId`, then failing `ParseIntPipe`) instead of the intended
 * self route. All self routes are grouped first; the `:operatorId` routes (2-segment
 * wildcard) and the 3-segment `:operatorId/ui|permissions|notifications` routes never
 * collide with each other (different segment counts), so their relative order is safe.
 */
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const callcenter_settings_service_1 = require("./callcenter-settings.service");
const callcenter_settings_dto_1 = require("./dto/callcenter-settings.dto");
const callcenter_rbac_util_1 = require("./callcenter-rbac.util");
let CallCenterSettingsController = class CallCenterSettingsController {
    settingsService;
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    // =======================================================================
    // Self (operator, own settings) — id from req.user.sub, never a client param.
    // Exact 2-segment paths; MUST precede the operator/:operatorId wildcard below.
    // =======================================================================
    getMyOperatorSettings(req) {
        return this.settingsService.getOperatorSettings(req.user.vpbx_user_uid, req.user.sub);
    }
    updateMyOperatorSettings(dto, req) {
        return this.settingsService.updateOperatorSettings(req.user.vpbx_user_uid, req.user.sub, dto);
    }
    /** D-05/D-06: own tab/panel visibility + softphone placement. */
    getMyUiCustomization(req) {
        return this.settingsService.getOperatorUiCustomization(req.user.vpbx_user_uid, req.user.sub);
    }
    updateMyUiCustomization(dto, req) {
        return this.settingsService.updateOperatorUiCustomization(req.user.vpbx_user_uid, req.user.sub, dto);
    }
    /** D-38: own effective permission set (role default + own override + locks, merged server-side). */
    getMyPermissions(req) {
        return this.settingsService.getOperatorPermissions(req.user.vpbx_user_uid, req.user.sub);
    }
    updateMyPermissions(dto, req) {
        return this.settingsService.updateOperatorPermissions(req.user.vpbx_user_uid, req.user.sub, dto);
    }
    /** D-41/D-43: own notification matrix (event × channel). */
    getMyNotifications(req) {
        return this.settingsService.getOperatorNotifications(req.user.vpbx_user_uid, req.user.sub);
    }
    updateMyNotifications(dto, req) {
        return this.settingsService.updateOperatorNotifications(req.user.vpbx_user_uid, req.user.sub, dto);
    }
    // =======================================================================
    // Supervisor-on-behalf-of (:operatorId is a client param, gated by assertSupervisor)
    // =======================================================================
    getOperatorSettingsBySupervisor(operatorId, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.getOperatorSettings(req.user.vpbx_user_uid, operatorId);
    }
    updateOperatorSettingsBySupervisor(operatorId, dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.updateOperatorSettings(req.user.vpbx_user_uid, operatorId, dto);
    }
    getUiCustomizationBySupervisor(operatorId, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.getOperatorUiCustomization(req.user.vpbx_user_uid, operatorId);
    }
    updateUiCustomizationBySupervisor(operatorId, dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.updateOperatorUiCustomization(req.user.vpbx_user_uid, operatorId, dto);
    }
    getPermissionsBySupervisor(operatorId, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.getOperatorPermissions(req.user.vpbx_user_uid, operatorId);
    }
    updatePermissionsBySupervisor(operatorId, dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.updateOperatorPermissions(req.user.vpbx_user_uid, operatorId, dto);
    }
    getNotificationsBySupervisor(operatorId, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.getOperatorNotifications(req.user.vpbx_user_uid, operatorId);
    }
    updateNotificationsBySupervisor(operatorId, dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.updateOperatorNotifications(req.user.vpbx_user_uid, operatorId, dto);
    }
    /** D-40: bulk operators × effective rights for the tenant — supervisor-gated. */
    getPermissionsMatrix(req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.getPermissionsMatrix(req.user.vpbx_user_uid);
    }
    // =======================================================================
    // Tenant singleton (role-default row)
    // =======================================================================
    getTenantSettings(req) {
        return this.settingsService.getTenantSettings(req.user.vpbx_user_uid);
    }
    updateTenantSettings(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.updateTenantSettings(req.user.vpbx_user_uid, dto);
    }
    // D-39/D-43: tenant role defaults + locks — GET and PUT both supervisor-gated
    // (unlike the plain `tenant` singleton above, whose GET is open to any tenant user).
    getTenantPermissionsDefaults(req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.getTenantPermissionsDefaults(req.user.vpbx_user_uid);
    }
    updateTenantPermissionsDefaults(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.updateTenantPermissionsDefaults(req.user.vpbx_user_uid, dto);
    }
    getTenantUiDefaults(req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.getTenantUiDefaults(req.user.vpbx_user_uid);
    }
    updateTenantUiDefaults(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.updateTenantUiDefaults(req.user.vpbx_user_uid, dto);
    }
    getTenantNotificationDefaults(req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.getTenantNotificationDefaults(req.user.vpbx_user_uid);
    }
    updateTenantNotificationDefaults(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.settingsService.updateTenantNotificationDefaults(req.user.vpbx_user_uid, dto);
    }
};
exports.CallCenterSettingsController = CallCenterSettingsController;
__decorate([
    (0, common_1.Get)('operator'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getMyOperatorSettings", null);
__decorate([
    (0, common_1.Put)('operator'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_settings_dto_1.UpdateOperatorSettingsDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "updateMyOperatorSettings", null);
__decorate([
    (0, common_1.Get)('operator/ui'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getMyUiCustomization", null);
__decorate([
    (0, common_1.Put)('operator/ui'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_settings_dto_1.UpdateUiCustomizationDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "updateMyUiCustomization", null);
__decorate([
    (0, common_1.Get)('operator/permissions'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getMyPermissions", null);
__decorate([
    (0, common_1.Put)('operator/permissions'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_settings_dto_1.UpdatePermissionsDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "updateMyPermissions", null);
__decorate([
    (0, common_1.Get)('operator/notifications'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getMyNotifications", null);
__decorate([
    (0, common_1.Put)('operator/notifications'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_settings_dto_1.UpdateNotificationMatrixDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "updateMyNotifications", null);
__decorate([
    (0, common_1.Get)('operator/:operatorId'),
    __param(0, (0, common_1.Param)('operatorId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getOperatorSettingsBySupervisor", null);
__decorate([
    (0, common_1.Put)('operator/:operatorId'),
    __param(0, (0, common_1.Param)('operatorId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, callcenter_settings_dto_1.UpdateOperatorSettingsDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "updateOperatorSettingsBySupervisor", null);
__decorate([
    (0, common_1.Get)('operator/:operatorId/ui'),
    __param(0, (0, common_1.Param)('operatorId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getUiCustomizationBySupervisor", null);
__decorate([
    (0, common_1.Put)('operator/:operatorId/ui'),
    __param(0, (0, common_1.Param)('operatorId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, callcenter_settings_dto_1.UpdateUiCustomizationDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "updateUiCustomizationBySupervisor", null);
__decorate([
    (0, common_1.Get)('operator/:operatorId/permissions'),
    __param(0, (0, common_1.Param)('operatorId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getPermissionsBySupervisor", null);
__decorate([
    (0, common_1.Put)('operator/:operatorId/permissions'),
    __param(0, (0, common_1.Param)('operatorId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, callcenter_settings_dto_1.UpdatePermissionsDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "updatePermissionsBySupervisor", null);
__decorate([
    (0, common_1.Get)('operator/:operatorId/notifications'),
    __param(0, (0, common_1.Param)('operatorId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getNotificationsBySupervisor", null);
__decorate([
    (0, common_1.Put)('operator/:operatorId/notifications'),
    __param(0, (0, common_1.Param)('operatorId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, callcenter_settings_dto_1.UpdateNotificationMatrixDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "updateNotificationsBySupervisor", null);
__decorate([
    (0, common_1.Get)('permissions/matrix'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getPermissionsMatrix", null);
__decorate([
    (0, common_1.Get)('tenant'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getTenantSettings", null);
__decorate([
    (0, common_1.Put)('tenant'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_settings_dto_1.UpdateCcSettingsDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "updateTenantSettings", null);
__decorate([
    (0, common_1.Get)('tenant/permissions-defaults'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getTenantPermissionsDefaults", null);
__decorate([
    (0, common_1.Put)('tenant/permissions-defaults'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_settings_dto_1.UpdateRoleDefaultsDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "updateTenantPermissionsDefaults", null);
__decorate([
    (0, common_1.Get)('tenant/ui-defaults'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getTenantUiDefaults", null);
__decorate([
    (0, common_1.Put)('tenant/ui-defaults'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_settings_dto_1.UpdateRoleDefaultsDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "updateTenantUiDefaults", null);
__decorate([
    (0, common_1.Get)('tenant/notification-defaults'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "getTenantNotificationDefaults", null);
__decorate([
    (0, common_1.Put)('tenant/notification-defaults'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_settings_dto_1.UpdateRoleDefaultsDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterSettingsController.prototype, "updateTenantNotificationDefaults", null);
exports.CallCenterSettingsController = CallCenterSettingsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('callcenter/settings'),
    __metadata("design:paramtypes", [callcenter_settings_service_1.CallCenterSettingsService])
], CallCenterSettingsController);
//# sourceMappingURL=callcenter-settings.controller.js.map