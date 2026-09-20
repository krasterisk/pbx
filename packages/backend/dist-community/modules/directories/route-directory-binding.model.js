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
exports.RouteDirectoryBinding = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const route_model_1 = require("../routes/route.model");
const directory_model_1 = require("./directory.model");
let RouteDirectoryBinding = class RouteDirectoryBinding extends sequelize_typescript_1.Model {
};
exports.RouteDirectoryBinding = RouteDirectoryBinding;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], RouteDirectoryBinding.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => route_model_1.Route),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], RouteDirectoryBinding.prototype, "route_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => directory_model_1.Directory),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], RouteDirectoryBinding.prototype, "directory_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], RouteDirectoryBinding.prototype, "position", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Object)
], RouteDirectoryBinding.prototype, "key_source", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('on_match'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false }),
    __metadata("design:type", String)
], RouteDirectoryBinding.prototype, "match_mode", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: false }),
    __metadata("design:type", String)
], RouteDirectoryBinding.prototype, "behavior_type", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(true),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, defaultValue: null }),
    __metadata("design:type", Object)
], RouteDirectoryBinding.prototype, "behavior_params", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(true),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, defaultValue: null }),
    __metadata("design:type", Object)
], RouteDirectoryBinding.prototype, "actions", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], RouteDirectoryBinding.prototype, "user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => route_model_1.Route, { foreignKey: 'route_uid', as: 'route' }),
    __metadata("design:type", route_model_1.Route)
], RouteDirectoryBinding.prototype, "route", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => directory_model_1.Directory, { foreignKey: 'directory_uid', as: 'directory' }),
    __metadata("design:type", directory_model_1.Directory)
], RouteDirectoryBinding.prototype, "directory", void 0);
exports.RouteDirectoryBinding = RouteDirectoryBinding = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'route_directory_bindings',
        timestamps: false,
        freezeTableName: true,
        indexes: [
            { name: 'idx_rdb_user_uid', fields: ['user_uid'] },
        ],
    })
], RouteDirectoryBinding);
//# sourceMappingURL=route-directory-binding.model.js.map