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
exports.ConferenceRoom = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
let ConferenceRoom = class ConferenceRoom extends sequelize_typescript_1.Model {
};
exports.ConferenceRoom = ConferenceRoom;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], ConferenceRoom.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], ConferenceRoom.prototype, "user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: false }),
    __metadata("design:type", String)
], ConferenceRoom.prototype, "number", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false }),
    __metadata("design:type", String)
], ConferenceRoom.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('permanent', 'ephemeral'),
        allowNull: false,
        defaultValue: 'permanent',
    }),
    __metadata("design:type", String)
], ConferenceRoom.prototype, "kind", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('token_name', 'token_name_pin', 'token_name_pin_moderator'),
        allowNull: false,
        defaultValue: 'token_name',
    }),
    __metadata("design:type", String)
], ConferenceRoom.prototype, "entry_strictness", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: true }),
    __metadata("design:type", Object)
], ConferenceRoom.prototype, "pin", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: false }),
    __metadata("design:type", Boolean)
], ConferenceRoom.prototype, "wait_marked", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: false }),
    __metadata("design:type", Boolean)
], ConferenceRoom.prototype, "end_marked", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('off', 'auto', 'button', 'both'),
        allowNull: false,
        defaultValue: 'off',
    }),
    __metadata("design:type", String)
], ConferenceRoom.prototype, "record_mode", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: true }),
    __metadata("design:type", Boolean)
], ConferenceRoom.prototype, "notify_recording", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('owner', 'moderator', 'anyone'),
        allowNull: false,
        defaultValue: 'owner',
    }),
    __metadata("design:type", String)
], ConferenceRoom.prototype, "invite_external_scope", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Object)
], ConferenceRoom.prototype, "tariff_max_participants", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", Object)
], ConferenceRoom.prototype, "musiconhold", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: false }),
    __metadata("design:type", Boolean)
], ConferenceRoom.prototype, "announce_join_leave", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Object)
], ConferenceRoom.prototype, "created_by", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], ConferenceRoom.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], ConferenceRoom.prototype, "updated_at", void 0);
exports.ConferenceRoom = ConferenceRoom = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'conference_rooms', timestamps: false, freezeTableName: true })
], ConferenceRoom);
//# sourceMappingURL=conference-room.model.js.map