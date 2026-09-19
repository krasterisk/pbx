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
exports.CloudSetting = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * cloud_settings — хранилище ключ-значение для настроек платформы.
 * Ключи формируют пространства имён через двоеточие:
 *   billing.seller.name, billing.seller.inn, billing.bank.bik, ...
 */
let CloudSetting = class CloudSetting extends sequelize_typescript_1.Model {
};
exports.CloudSetting = CloudSetting;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], CloudSetting.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: false, unique: true }),
    __metadata("design:type", String)
], CloudSetting.prototype, "key", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", Object)
], CloudSetting.prototype, "value", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", Object)
], CloudSetting.prototype, "description", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], CloudSetting.prototype, "created_at", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], CloudSetting.prototype, "updated_at", void 0);
exports.CloudSetting = CloudSetting = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'cloud_settings', timestamps: true })
], CloudSetting);
//# sourceMappingURL=cloud-setting.model.js.map