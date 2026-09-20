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
exports.RouteTemplate = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
let RouteTemplate = class RouteTemplate extends sequelize_typescript_1.Model {
};
exports.RouteTemplate = RouteTemplate;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], RouteTemplate.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false }),
    __metadata("design:type", String)
], RouteTemplate.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(''),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(512), allowNull: false }),
    __metadata("design:type", String)
], RouteTemplate.prototype, "description", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Array)
], RouteTemplate.prototype, "actions", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Array)
], RouteTemplate.prototype, "slots", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(true),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, defaultValue: null }),
    __metadata("design:type", Object)
], RouteTemplate.prototype, "vpbx_user_uid", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], RouteTemplate.prototype, "created_at", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], RouteTemplate.prototype, "updated_at", void 0);
exports.RouteTemplate = RouteTemplate = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'route_templates',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        freezeTableName: true,
        indexes: [
            { name: 'idx_route_templates_vpbx_user_uid', fields: ['vpbx_user_uid'] },
            { name: 'uq_route_templates_tenant_name', unique: true, fields: ['vpbx_user_uid', 'name'] },
        ],
    })
], RouteTemplate);
//# sourceMappingURL=route-template.model.js.map