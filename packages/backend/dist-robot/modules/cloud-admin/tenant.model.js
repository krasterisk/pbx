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
exports.Tenant = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
let Tenant = class Tenant extends sequelize_typescript_1.Model {
};
exports.Tenant = Tenant;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], Tenant.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(36) }),
    __metadata("design:type", String)
], Tenant.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255) }),
    __metadata("design:type", String)
], Tenant.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", Object)
], Tenant.prototype, "slug", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], Tenant.prototype, "owner_user_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], Tenant.prototype, "vpbx_user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('trial'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.ENUM('trial', 'active', 'suspended', 'cancelled') }),
    __metadata("design:type", String)
], Tenant.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], Tenant.prototype, "trial_ends_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", Object)
], Tenant.prototype, "email", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: true }),
    __metadata("design:type", Object)
], Tenant.prototype, "phone", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: true }),
    __metadata("design:type", Object)
], Tenant.prototype, "company_inn", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(10),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], Tenant.prototype, "max_extensions", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(2),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], Tenant.prototype, "max_trunks", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(3),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], Tenant.prototype, "max_queues", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Object)
], Tenant.prototype, "created_by", void 0);
exports.Tenant = Tenant = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'tenants', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })
], Tenant);
//# sourceMappingURL=tenant.model.js.map