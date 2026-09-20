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
exports.Directory = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const directory_field_model_1 = require("./directory-field.model");
const directory_record_model_1 = require("./directory-record.model");
const route_directory_binding_model_1 = require("./route-directory-binding.model");
let Directory = class Directory extends sequelize_typescript_1.Model {
};
exports.Directory = Directory;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], Directory.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], Directory.prototype, "user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false }),
    __metadata("design:type", String)
], Directory.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(''),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false }),
    __metadata("design:type", String)
], Directory.prototype, "description", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(true),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, defaultValue: null }),
    __metadata("design:type", Object)
], Directory.prototype, "lookup_field_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('none'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false }),
    __metadata("design:type", String)
], Directory.prototype, "key_normalization", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], Directory.prototype, "revision", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], Directory.prototype, "created_at", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], Directory.prototype, "updated_at", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => directory_field_model_1.DirectoryField, 'directory_uid'),
    __metadata("design:type", Array)
], Directory.prototype, "fields", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => directory_record_model_1.DirectoryRecord, 'directory_uid'),
    __metadata("design:type", Array)
], Directory.prototype, "records", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => route_directory_binding_model_1.RouteDirectoryBinding, { foreignKey: 'directory_uid', as: 'bindings' }),
    __metadata("design:type", Array)
], Directory.prototype, "bindings", void 0);
exports.Directory = Directory = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'directories',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        freezeTableName: true,
        indexes: [
            { name: 'idx_directories_user_uid', fields: ['user_uid'] },
            { name: 'uq_directories_tenant_name', unique: true, fields: ['user_uid', 'name'] },
        ],
    })
], Directory);
//# sourceMappingURL=directory.model.js.map