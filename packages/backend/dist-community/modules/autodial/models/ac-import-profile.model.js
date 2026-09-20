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
exports.AcImportProfile = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const ac_base_model_1 = require("./ac-base.model");
let AcImportProfile = class AcImportProfile extends sequelize_typescript_1.Model {
};
exports.AcImportProfile = AcImportProfile;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], AcImportProfile.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => ac_base_model_1.AcBase),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AcImportProfile.prototype, "base_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], AcImportProfile.prototype, "user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false }),
    __metadata("design:type", String)
], AcImportProfile.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('csv'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(8), allowNull: false }),
    __metadata("design:type", String)
], AcImportProfile.prototype, "source", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(';'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(4), allowNull: false }),
    __metadata("design:type", String)
], AcImportProfile.prototype, "delimiter", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('utf-8'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: false }),
    __metadata("design:type", String)
], AcImportProfile.prototype, "encoding", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(true),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false }),
    __metadata("design:type", Boolean)
], AcImportProfile.prototype, "has_header", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Array)
], AcImportProfile.prototype, "column_map", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('phone'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false }),
    __metadata("design:type", String)
], AcImportProfile.prototype, "dedup_policy", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], AcImportProfile.prototype, "created_at", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], AcImportProfile.prototype, "updated_at", void 0);
exports.AcImportProfile = AcImportProfile = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'ac_import_profiles',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        freezeTableName: true,
    })
], AcImportProfile);
//# sourceMappingURL=ac-import-profile.model.js.map