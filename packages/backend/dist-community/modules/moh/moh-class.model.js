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
exports.MohClass = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Sequelize model for the Asterisk Realtime `musiconhold` table.
 * Uses mode=playlist with entries in `musiconhold_entry` (ARA).
 * Column `user_uid` is custom (Asterisk ignores unknown columns).
 */
let MohClass = class MohClass extends sequelize_typescript_1.Model {
};
exports.MohClass = MohClass;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), field: 'name' }),
    __metadata("design:type", String)
], MohClass.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('custom', 'files', 'mp3nb', 'quietmp3nb', 'quietmp3', 'playlist'),
        allowNull: true,
        defaultValue: 'playlist',
    }),
    __metadata("design:type", String)
], MohClass.prototype, "mode", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(256), allowNull: true }),
    __metadata("design:type", String)
], MohClass.prototype, "directory", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(10), allowNull: true, defaultValue: 'random' }),
    __metadata("design:type", String)
], MohClass.prototype, "sort", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true, defaultValue: 0 }),
    __metadata("design:type", Number)
], MohClass.prototype, "user_uid", void 0);
exports.MohClass = MohClass = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'musiconhold', timestamps: false, freezeTableName: true })
], MohClass);
//# sourceMappingURL=moh-class.model.js.map