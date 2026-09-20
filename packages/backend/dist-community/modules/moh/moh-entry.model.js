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
exports.MohEntry = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Sequelize model for the Asterisk Realtime `musiconhold_entry` table.
 * Composite PK: (name, position) — standard Asterisk schema.
 * `entry` contains the absolute path to the audio file on the Asterisk server.
 */
let MohEntry = class MohEntry extends sequelize_typescript_1.Model {
};
exports.MohEntry = MohEntry;
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), primaryKey: true }),
    __metadata("design:type", String)
], MohEntry.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, primaryKey: true }),
    __metadata("design:type", Number)
], MohEntry.prototype, "position", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(256), allowNull: false }),
    __metadata("design:type", String)
], MohEntry.prototype, "entry", void 0);
exports.MohEntry = MohEntry = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'musiconhold_entry', timestamps: false, freezeTableName: true })
], MohEntry);
//# sourceMappingURL=moh-entry.model.js.map