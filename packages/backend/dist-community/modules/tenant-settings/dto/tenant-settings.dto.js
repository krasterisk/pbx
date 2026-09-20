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
exports.UpdateTenantSettingsDto = exports.IsTenantSettingKeysConstraint = void 0;
exports.IsTenantSettingKeys = IsTenantSettingKeys;
const class_validator_1 = require("class-validator");
const tenant_settings_keys_1 = require("../tenant-settings.keys");
let IsTenantSettingKeysConstraint = class IsTenantSettingKeysConstraint {
    validate(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return false;
        return Object.keys(value).every((k) => k in tenant_settings_keys_1.TENANT_SETTING_KEYS);
    }
    defaultMessage() {
        return 'settings contains keys that are not in TENANT_SETTING_KEYS';
    }
};
exports.IsTenantSettingKeysConstraint = IsTenantSettingKeysConstraint;
exports.IsTenantSettingKeysConstraint = IsTenantSettingKeysConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isTenantSettingKeys', async: false })
], IsTenantSettingKeysConstraint);
/** Custom validator — unknown keys are rejected by ValidationPipe, not silently dropped. */
function IsTenantSettingKeys() {
    return (0, class_validator_1.Validate)(IsTenantSettingKeysConstraint);
}
class UpdateTenantSettingsDto {
    settings;
    /** Declared so global forbidNonWhitelisted does not 400; never read — tenant is JWT-only. */
    vpbx_user_uid;
}
exports.UpdateTenantSettingsDto = UpdateTenantSettingsDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    IsTenantSettingKeys(),
    __metadata("design:type", Object)
], UpdateTenantSettingsDto.prototype, "settings", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdateTenantSettingsDto.prototype, "vpbx_user_uid", void 0);
//# sourceMappingURL=tenant-settings.dto.js.map