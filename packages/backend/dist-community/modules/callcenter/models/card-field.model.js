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
exports.CcCardField = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Field definition within a call card template (D-11).
 *
 * v1 field types (14): text, textarea, phone, email, select, multi_select, date,
 * datetime, number, checkbox, phonebook_lookup, divider, heading, readonly.
 *
 * 'file' upload is intentionally excluded from v1 — requires storage/limits evaluation.
 */
let CcCardField = class CcCardField extends sequelize_typescript_1.Model {
};
exports.CcCardField = CcCardField;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], CcCardField.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], CcCardField.prototype, "template_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], CcCardField.prototype, "field_key", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('text', 'textarea', 'phone', 'email', 'select', 'multi_select', 'date', 'datetime', 'number', 'checkbox', 'phonebook_lookup', 'divider', 'heading', 'readonly'),
        allowNull: false,
    }),
    __metadata("design:type", String)
], CcCardField.prototype, "field_type", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: false }),
    __metadata("design:type", String)
], CcCardField.prototype, "label", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(256), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcCardField.prototype, "placeholder", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: false }),
    __metadata("design:type", Boolean)
], CcCardField.prototype, "is_required", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(256), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcCardField.prototype, "default_value", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], CcCardField.prototype, "options", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true }),
    __metadata("design:type", Object)
], CcCardField.prototype, "depends_on", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], CcCardField.prototype, "depends_values", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcCardField.prototype, "sort_order", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('full', 'half'),
        allowNull: false,
        defaultValue: 'full',
    }),
    __metadata("design:type", String)
], CcCardField.prototype, "width", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true }),
    __metadata("design:type", Object)
], CcCardField.prototype, "auto_populate", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], CcCardField.prototype, "user_uid", void 0);
exports.CcCardField = CcCardField = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'cc_card_fields', timestamps: false })
], CcCardField);
//# sourceMappingURL=card-field.model.js.map