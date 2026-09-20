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
exports.ConferenceGuestToken = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Opaque hex invite token (NOT JWT). Tenant scope arrives via room_uid FK cascade.
 */
let ConferenceGuestToken = class ConferenceGuestToken extends sequelize_typescript_1.Model {
};
exports.ConferenceGuestToken = ConferenceGuestToken;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], ConferenceGuestToken.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], ConferenceGuestToken.prototype, "room_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], ConferenceGuestToken.prototype, "token", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('shared_link', 'named_invite'),
        allowNull: false,
    }),
    __metadata("design:type", String)
], ConferenceGuestToken.prototype, "kind", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", Object)
], ConferenceGuestToken.prototype, "invite_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], ConferenceGuestToken.prototype, "expires_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], ConferenceGuestToken.prototype, "revoked_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], ConferenceGuestToken.prototype, "last_used_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true }),
    __metadata("design:type", Object)
], ConferenceGuestToken.prototype, "display_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true }),
    __metadata("design:type", Object)
], ConferenceGuestToken.prototype, "sip_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false, defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], ConferenceGuestToken.prototype, "created_at", void 0);
exports.ConferenceGuestToken = ConferenceGuestToken = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'conference_guest_tokens', timestamps: false, freezeTableName: true })
], ConferenceGuestToken);
//# sourceMappingURL=conference-guest-token.model.js.map