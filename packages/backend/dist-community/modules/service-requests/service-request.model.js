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
exports.ServiceRequest = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * ServiceRequest — таблица обращений клиентов (клиентская база call-центра).
 *
 * Каждая запись = одно обращение (заявка), с которым работает оператор.
 * В отличие от voice_robot_logs (пошаговый лог робота, несколько записей на 1 звонок),
 * здесь 1 запись = 1 обращение/заявка.
 *
 * Связь с voice_robot_logs: по полю call_uniqueid (Asterisk Unique-ID звонка).
 */
let ServiceRequest = class ServiceRequest extends sequelize_typescript_1.Model {
};
exports.ServiceRequest = ServiceRequest;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BIGINT }),
    __metadata("design:type", Number)
], ServiceRequest.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "operator_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "operator_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false }),
    __metadata("design:type", Date)
], ServiceRequest.prototype, "call_received_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "call_uniqueid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true, unique: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "request_number", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('individual'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(20), allowNull: false }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "counterparty_type", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(512), allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "counterparty_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "account_or_inn", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "phone", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "territorial_zone", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "locality", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "district", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(512), allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "address", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "topic", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "comment", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "production_comment", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "schedule_comment", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('not_sent'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(20), allowNull: false }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "sms_status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "scheduled_date", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('new'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(20), allowNull: false }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "request_status", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], ServiceRequest.prototype, "user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(sequelize_typescript_1.DataType.NOW),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, field: 'created_at' }),
    __metadata("design:type", Date)
], ServiceRequest.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(sequelize_typescript_1.DataType.NOW),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, field: 'updated_at' }),
    __metadata("design:type", Date)
], ServiceRequest.prototype, "updated_at", void 0);
exports.ServiceRequest = ServiceRequest = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'service_requests', timestamps: false, freezeTableName: true })
], ServiceRequest);
//# sourceMappingURL=service-request.model.js.map