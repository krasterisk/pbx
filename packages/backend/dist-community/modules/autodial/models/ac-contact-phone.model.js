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
exports.AcContactPhone = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const ac_contact_model_1 = require("./ac-contact.model");
let AcContactPhone = class AcContactPhone extends sequelize_typescript_1.Model {
};
exports.AcContactPhone = AcContactPhone;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], AcContactPhone.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => ac_contact_model_1.AcContact),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AcContactPhone.prototype, "contact_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AcContactPhone.prototype, "base_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], AcContactPhone.prototype, "raw", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], AcContactPhone.prototype, "normalized", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AcContactPhone.prototype, "position", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false }),
    __metadata("design:type", Boolean)
], AcContactPhone.prototype, "is_primary", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(180),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AcContactPhone.prototype, "tz_offset_min", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => ac_contact_model_1.AcContact, { foreignKey: 'contact_uid' }),
    __metadata("design:type", ac_contact_model_1.AcContact)
], AcContactPhone.prototype, "contact", void 0);
exports.AcContactPhone = AcContactPhone = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'ac_contact_phones',
        timestamps: false,
        freezeTableName: true,
    })
], AcContactPhone);
//# sourceMappingURL=ac-contact-phone.model.js.map