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
exports.PsRegistration = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Sequelize model for Asterisk PJSIP outbound registrations.
 * Maps to the `ps_registrations` Realtime table used by res_pjsip_outbound_registration.
 */
let PsRegistration = class PsRegistration extends sequelize_typescript_1.Model {
};
exports.PsRegistration = PsRegistration;
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), primaryKey: true }),
    __metadata("design:type", String)
], PsRegistration.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.ENUM('yes', 'no'), allowNull: true }),
    __metadata("design:type", String)
], PsRegistration.prototype, "auth_rejection_permanent", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", String)
], PsRegistration.prototype, "client_uri", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsRegistration.prototype, "contact_user", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsRegistration.prototype, "expiration", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsRegistration.prototype, "max_retries", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsRegistration.prototype, "outbound_auth", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsRegistration.prototype, "outbound_proxy", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsRegistration.prototype, "retry_interval", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsRegistration.prototype, "forbidden_retry_interval", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", String)
], PsRegistration.prototype, "server_uri", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsRegistration.prototype, "transport", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.ENUM('yes', 'no'), allowNull: true }),
    __metadata("design:type", String)
], PsRegistration.prototype, "support_path", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.ENUM('yes', 'no'), allowNull: true }),
    __metadata("design:type", String)
], PsRegistration.prototype, "line", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsRegistration.prototype, "endpoint", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true, defaultValue: 'registration' }),
    __metadata("design:type", String)
], PsRegistration.prototype, "type", void 0);
exports.PsRegistration = PsRegistration = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ps_registrations', timestamps: false, freezeTableName: true })
], PsRegistration);
//# sourceMappingURL=ps-registration.model.js.map