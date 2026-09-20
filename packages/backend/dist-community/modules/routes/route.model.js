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
exports.Route = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const context_model_1 = require("../contexts/context.model");
const route_directory_binding_model_1 = require("../directories/route-directory-binding.model");
let Route = class Route extends sequelize_typescript_1.Model {
};
exports.Route = Route;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], Route.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => context_model_1.Context),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], Route.prototype, "context_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], Route.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Array)
], Route.prototype, "extensions", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], Route.prototype, "priority", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TINYINT, allowNull: false, defaultValue: 1 }),
    __metadata("design:type", Number)
], Route.prototype, "active", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, defaultValue: null }),
    __metadata("design:type", Object)
], Route.prototype, "options", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, defaultValue: null }),
    __metadata("design:type", Object)
], Route.prototype, "webhooks", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Array)
], Route.prototype, "actions", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, defaultValue: null }),
    __metadata("design:type", Object)
], Route.prototype, "raw_dialplan", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], Route.prototype, "user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, field: 'created_at' }),
    __metadata("design:type", Date)
], Route.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, field: 'updated_at' }),
    __metadata("design:type", Date)
], Route.prototype, "updated_at", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => context_model_1.Context, 'context_uid'),
    __metadata("design:type", context_model_1.Context)
], Route.prototype, "context", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => route_directory_binding_model_1.RouteDirectoryBinding, { foreignKey: 'route_uid', as: 'bindings' }),
    __metadata("design:type", Array)
], Route.prototype, "bindings", void 0);
exports.Route = Route = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'routes', timestamps: false, freezeTableName: true })
], Route);
//# sourceMappingURL=route.model.js.map