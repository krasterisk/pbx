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
exports.DirectoryField = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const directory_model_1 = require("./directory.model");
let DirectoryField = class DirectoryField extends sequelize_typescript_1.Model {
};
exports.DirectoryField = DirectoryField;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], DirectoryField.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => directory_model_1.Directory),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], DirectoryField.prototype, "directory_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], DirectoryField.prototype, "key", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false }),
    __metadata("design:type", String)
], DirectoryField.prototype, "label", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false }),
    __metadata("design:type", String)
], DirectoryField.prototype, "type", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false }),
    __metadata("design:type", Boolean)
], DirectoryField.prototype, "required", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], DirectoryField.prototype, "position", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => directory_model_1.Directory, 'directory_uid'),
    __metadata("design:type", directory_model_1.Directory)
], DirectoryField.prototype, "directory", void 0);
exports.DirectoryField = DirectoryField = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'directory_fields',
        timestamps: false,
        freezeTableName: true,
        indexes: [
            { name: 'uq_directory_fields_key', unique: true, fields: ['directory_uid', 'key'] },
        ],
    })
], DirectoryField);
//# sourceMappingURL=directory-field.model.js.map