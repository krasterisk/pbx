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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRoleDefaultsDto = exports.UpdateNotificationMatrixDto = exports.UpdatePermissionsDto = exports.UpdateUiCustomizationDto = exports.UpdateCcSettingsDto = exports.CallbackPolicyDto = exports.UpdateOperatorSettingsDto = void 0;
/**
 * Call Center settings DTOs (D-22 operator settings, D-27 tenant thresholds,
 * D-05/D-06/D-38...D-43 UI customization / granular permissions / notification matrix).
 * Intentionally omit operator_user_id / user_uid — IDs come from session (IDOR mitigation).
 */
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const shared_1 = require("@krasterisk/shared");
const SOFTPHONE_PLACEMENTS = ['bottom-right', 'bottom-left', 'hidden'];
const SPY_MODES = ['listen', 'whisper', 'barge'];
class UpdateOperatorSettingsDto {
    pickup_enabled;
    auto_answer;
    auto_answer_zip_tone;
    wrapup_timeout;
    wrapup_extend_step;
    wrapup_autosave_draft;
    sound_incoming;
    sound_missed;
    notifications_enabled;
    volume;
}
exports.UpdateOperatorSettingsDto = UpdateOperatorSettingsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateOperatorSettingsDto.prototype, "pickup_enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateOperatorSettingsDto.prototype, "auto_answer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateOperatorSettingsDto.prototype, "auto_answer_zip_tone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateOperatorSettingsDto.prototype, "wrapup_timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateOperatorSettingsDto.prototype, "wrapup_extend_step", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateOperatorSettingsDto.prototype, "wrapup_autosave_draft", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateOperatorSettingsDto.prototype, "sound_incoming", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateOperatorSettingsDto.prototype, "sound_missed", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateOperatorSettingsDto.prototype, "notifications_enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpdateOperatorSettingsDto.prototype, "volume", void 0);
class CallbackPolicyDto {
    order_mode;
    dtmf_digit;
    dial_order;
}
exports.CallbackPolicyDto = CallbackPolicyDto;
__decorate([
    (0, class_validator_1.IsIn)([...shared_1.CALLBACK_ORDER_MODES]),
    __metadata("design:type", Object)
], CallbackPolicyDto.prototype, "order_mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[0-9*#]$/),
    __metadata("design:type", String)
], CallbackPolicyDto.prototype, "dtmf_digit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...shared_1.CALLBACK_DIAL_ORDERS]),
    __metadata("design:type", Object)
], CallbackPolicyDto.prototype, "dial_order", void 0);
class UpdateCcSettingsDto {
    default_sla_threshold;
    /** D-04: Journal last-N depth (tenant-level; no per-operator override). */
    journal_depth;
    alert_sound_enabled;
    /** Whitelisted keys enforced in service (T-07-05-04). */
    alert_thresholds;
    /**
     * D-15: flexible auto-pause rules (missed_count / idle_time / status_duration).
     * Deep shape enforced by sanitizeAutopauseRules — RONA is never a writable type.
     */
    autopause_rules;
    /** Master switch: when false, RONA + rules are inactive. */
    autopause_enabled;
    /** Auto-close / extension-free policy for open agent shifts. */
    shift_policy;
    /** D-49: callback order_mode / dtmf_digit / dial_order. */
    callback_policy;
}
exports.UpdateCcSettingsDto = UpdateCcSettingsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateCcSettingsDto.prototype, "default_sla_threshold", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(500),
    __metadata("design:type", Number)
], UpdateCcSettingsDto.prototype, "journal_depth", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCcSettingsDto.prototype, "alert_sound_enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateCcSettingsDto.prototype, "alert_thresholds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpdateCcSettingsDto.prototype, "autopause_rules", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCcSettingsDto.prototype, "autopause_enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateCcSettingsDto.prototype, "shift_policy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CallbackPolicyDto),
    __metadata("design:type", CallbackPolicyDto)
], UpdateCcSettingsDto.prototype, "callback_policy", void 0);
/** D-05: tab/panel visibility + softphone placement. Locked keys rejected server-side (D-06). */
class UpdateUiCustomizationDto {
    /** Keys are UI-SPEC surface ids (coworkers/queues/waiting/...); values on/off. */
    ui_visibility;
    softphone_placement;
}
exports.UpdateUiCustomizationDto = UpdateUiCustomizationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateUiCustomizationDto.prototype, "ui_visibility", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(SOFTPHONE_PLACEMENTS),
    __metadata("design:type", String)
], UpdateUiCustomizationDto.prototype, "softphone_placement", void 0);
/**
 * D-38/D-21/D-22: per-operator granular rights. Locked rights (per role, D-06/D-39)
 * are ignored server-side — see CallCenterSettingsService.updateOperatorPermissions.
 */
class UpdatePermissionsDto {
    can_spy;
    spyable;
    spy_modes;
    click_to_call;
    customize_ui;
}
exports.UpdatePermissionsDto = UpdatePermissionsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdatePermissionsDto.prototype, "can_spy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdatePermissionsDto.prototype, "spyable", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsIn)(SPY_MODES, { each: true }),
    __metadata("design:type", Array)
], UpdatePermissionsDto.prototype, "spy_modes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdatePermissionsDto.prototype, "click_to_call", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdatePermissionsDto.prototype, "customize_ui", void 0);
/** D-41/D-42/D-43: event × channel notification matrix. Whitelisted in service. */
class UpdateNotificationMatrixDto {
    notification_matrix;
}
exports.UpdateNotificationMatrixDto = UpdateNotificationMatrixDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateNotificationMatrixDto.prototype, "notification_matrix", void 0);
/**
 * D-39/D-43: tenant role-default + lock update body — shared shape for all three
 * `tenant/*-defaults` endpoints; each endpoint only reads/writes the fields relevant
 * to it (unused fields are ignored server-side, not an error).
 */
class UpdateRoleDefaultsDto {
    /** tenant/permissions-defaults: role default PermissionSet, keyed by UserLevel. */
    role_permission_defaults;
    /** tenant/permissions-defaults: per-right lock flags, keyed by UserLevel. */
    permission_locks;
    /** tenant/ui-defaults: role-default tab/panel visibility (flat, not per-level). */
    ui_visibility_defaults;
    /** tenant/ui-defaults: ui_visibility keys locked for operator self-override. */
    ui_visibility_locks;
    /** tenant/notification-defaults: role-default notification matrix (flat). */
    notification_defaults;
    /** tenant/notification-defaults: events locked for operator self-override. */
    notification_locks;
}
exports.UpdateRoleDefaultsDto = UpdateRoleDefaultsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateRoleDefaultsDto.prototype, "role_permission_defaults", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateRoleDefaultsDto.prototype, "permission_locks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateRoleDefaultsDto.prototype, "ui_visibility_defaults", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateRoleDefaultsDto.prototype, "ui_visibility_locks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateRoleDefaultsDto.prototype, "notification_defaults", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateRoleDefaultsDto.prototype, "notification_locks", void 0);
//# sourceMappingURL=callcenter-settings.dto.js.map