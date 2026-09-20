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
exports.Cdr = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Asterisk CDR table (extended via cdr_adaptive_odbc.conf).
 * One row = one call leg; use GROUP BY linkedid in service for call summaries.
 */
let Cdr = class Cdr extends sequelize_typescript_1.Model {
};
exports.Cdr = Cdr;
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: true }),
    __metadata("design:type", String)
], Cdr.prototype, "calldate", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], Cdr.prototype, "clid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], Cdr.prototype, "src", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], Cdr.prototype, "usrc", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], Cdr.prototype, "dst", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], Cdr.prototype, "dcontext", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], Cdr.prototype, "channel", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], Cdr.prototype, "dstchannel", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], Cdr.prototype, "lastapp", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], Cdr.prototype, "lastdata", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], Cdr.prototype, "duration", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], Cdr.prototype, "billsec", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(45), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], Cdr.prototype, "disposition", void 0);
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: false }),
    __metadata("design:type", String)
], Cdr.prototype, "uniqueid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], Cdr.prototype, "linkedid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", String)
], Cdr.prototype, "userfield", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(20), allowNull: true }),
    __metadata("design:type", Object)
], Cdr.prototype, "dialednum", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: true }),
    __metadata("design:type", Object)
], Cdr.prototype, "transid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", Object)
], Cdr.prototype, "record", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true, defaultValue: 0 }),
    __metadata("design:type", Number)
], Cdr.prototype, "vpbx_user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Object)
], Cdr.prototype, "useruid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Object)
], Cdr.prototype, "dstuseruid", void 0);
exports.Cdr = Cdr = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'cdr', timestamps: false, freezeTableName: true })
], Cdr);
//# sourceMappingURL=cdr.model.js.map