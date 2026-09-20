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
exports.PsEndpointIdIp = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Sequelize model for Asterisk PJSIP endpoint identification by IP.
 * Maps to `ps_endpoint_id_ips` Realtime table used by res_pjsip_endpoint_identifier_ip.
 */
let PsEndpointIdIp = class PsEndpointIdIp extends sequelize_typescript_1.Model {
};
exports.PsEndpointIdIp = PsEndpointIdIp;
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), primaryKey: true }),
    __metadata("design:type", String)
], PsEndpointIdIp.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpointIdIp.prototype, "endpoint", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: true }),
    __metadata("design:type", String)
], PsEndpointIdIp.prototype, "match", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.ENUM('yes', 'no'), allowNull: true }),
    __metadata("design:type", String)
], PsEndpointIdIp.prototype, "srv_lookups", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", String)
], PsEndpointIdIp.prototype, "match_header", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true, defaultValue: 'identify' }),
    __metadata("design:type", String)
], PsEndpointIdIp.prototype, "type", void 0);
exports.PsEndpointIdIp = PsEndpointIdIp = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ps_endpoint_id_ips', timestamps: false, freezeTableName: true })
], PsEndpointIdIp);
//# sourceMappingURL=ps-endpoint-id-ip.model.js.map