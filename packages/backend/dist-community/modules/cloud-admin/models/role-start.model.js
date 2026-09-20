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
exports.TenantRoleStart = exports.RoleStartDefault = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/** Platform-global role→start defaults (D-04 / D-16). */
let RoleStartDefault = class RoleStartDefault extends sequelize_typescript_1.Model {
};
exports.RoleStartDefault = RoleStartDefault;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], RoleStartDefault.prototype, "id", void 0);
__decorate([
    sequelize_typescript_1.Unique,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], RoleStartDefault.prototype, "user_level", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(255)),
    __metadata("design:type", String)
], RoleStartDefault.prototype, "start_path", void 0);
exports.RoleStartDefault = RoleStartDefault = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'role_start_defaults',
        timestamps: false,
    })
], RoleStartDefault);
/** Per-tenant role→start overrides (D-04). */
let TenantRoleStart = class TenantRoleStart extends sequelize_typescript_1.Model {
};
exports.TenantRoleStart = TenantRoleStart;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], TenantRoleStart.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], TenantRoleStart.prototype, "tenant_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], TenantRoleStart.prototype, "user_level", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(255)),
    __metadata("design:type", String)
], TenantRoleStart.prototype, "start_path", void 0);
exports.TenantRoleStart = TenantRoleStart = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'tenant_role_start',
        timestamps: false,
        indexes: [
            { unique: true, fields: ['tenant_id', 'user_level'], name: 'uq_tenant_role_start' },
        ],
    })
], TenantRoleStart);
//# sourceMappingURL=role-start.model.js.map