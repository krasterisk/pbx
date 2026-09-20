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
exports.CcCardData = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Saved call card instance — field values bound to a call (call_uniqueid).
 */
let CcCardData = class CcCardData extends sequelize_typescript_1.Model {
};
exports.CcCardData = CcCardData;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.BIGINT }),
    __metadata("design:type", Number)
], CcCardData.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], CcCardData.prototype, "template_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcCardData.prototype, "call_uniqueid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcCardData.prototype, "caller_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcCardData.prototype, "queue_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Object)
], CcCardData.prototype, "agent_user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('draft', 'saved', 'missed', 'callback_done'),
        allowNull: false,
        defaultValue: 'saved',
    }),
    __metadata("design:type", String)
], CcCardData.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Object)
], CcCardData.prototype, "field_values", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false, defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], CcCardData.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], CcCardData.prototype, "updated_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], CcCardData.prototype, "user_uid", void 0);
exports.CcCardData = CcCardData = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'cc_card_data', timestamps: false })
], CcCardData);
//# sourceMappingURL=card-data.model.js.map