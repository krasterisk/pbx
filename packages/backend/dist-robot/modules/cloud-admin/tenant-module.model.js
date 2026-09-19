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
exports.TenantModule = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
let TenantModule = class TenantModule extends sequelize_typescript_1.Model {
};
exports.TenantModule = TenantModule;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], TenantModule.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], TenantModule.prototype, "tenant_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(64)),
    __metadata("design:type", String)
], TenantModule.prototype, "module_code", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('active'),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.ENUM('active', 'inactive', 'trial', 'expired')),
    __metadata("design:type", String)
], TenantModule.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(sequelize_typescript_1.DataType.NOW),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], TenantModule.prototype, "activated_at", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(true),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Object)
], TenantModule.prototype, "expires_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('monthly'),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.ENUM('monthly', 'yearly', 'lifetime')),
    __metadata("design:type", String)
], TenantModule.prototype, "billing_cycle", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(true),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Object)
], TenantModule.prototype, "last_billed_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('{}'),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.JSON),
    __metadata("design:type", Object)
], TenantModule.prototype, "config", void 0);
exports.TenantModule = TenantModule = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'tenant_modules',
        timestamps: false,
        indexes: [
            { unique: true, fields: ['tenant_id', 'module_code'], name: 'uq_tenant_module' },
            { fields: ['tenant_id'], name: 'idx_tm_tenant' },
        ],
    })
], TenantModule);
//# sourceMappingURL=tenant-module.model.js.map