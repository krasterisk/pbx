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
exports.TenantSetting = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Per-tenant settings (D-19). Uniqueness is composite (vpbx_user_uid, key) —
 * `key` is NOT unique on its own (that would make the setting global).
 */
let TenantSetting = class TenantSetting extends sequelize_typescript_1.Model {
};
exports.TenantSetting = TenantSetting;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], TenantSetting.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ field: 'vpbx_user_uid', type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], TenantSetting.prototype, "vpbxUserUid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: false }),
    __metadata("design:type", String)
], TenantSetting.prototype, "key", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", Object)
], TenantSetting.prototype, "value", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), defaultValue: 'general' }),
    __metadata("design:type", String)
], TenantSetting.prototype, "category", void 0);
exports.TenantSetting = TenantSetting = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'tenant_settings', timestamps: false, freezeTableName: true })
], TenantSetting);
//# sourceMappingURL=tenant-setting.model.js.map