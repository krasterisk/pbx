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
exports.VoiceRobotCdr = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * VoiceRobotCdr — CDR (Call Detail Record) голосового робота.
 *
 * 1 запись = 1 звонок (в отличие от voice_robot_logs, где 1 звонок = N шагов).
 * Содержит сводную информацию: кто звонил, сколько длился диалог,
 * чем закончился, сколько шагов прошёл.
 *
 * Создаётся при завершении сессии (cleanup).
 */
let VoiceRobotCdr = class VoiceRobotCdr extends sequelize_typescript_1.Model {
};
exports.VoiceRobotCdr = VoiceRobotCdr;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BIGINT }),
    __metadata("design:type", Number)
], VoiceRobotCdr.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotCdr.prototype, "robot_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "robot_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "call_uniqueid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "channel_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "session_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "caller_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "caller_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false }),
    __metadata("design:type", Date)
], VoiceRobotCdr.prototype, "started_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "ended_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotCdr.prototype, "duration_seconds", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('completed'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: false }),
    __metadata("design:type", String)
], VoiceRobotCdr.prototype, "disposition", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "last_action", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "transfer_target", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotCdr.prototype, "total_steps", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotCdr.prototype, "matched_keywords_count", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotCdr.prototype, "no_match_count", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DECIMAL(5, 2), allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "avg_confidence", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "collected_slots", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "transcript", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotCdr.prototype, "tags", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotCdr.prototype, "user_uid", void 0);
exports.VoiceRobotCdr = VoiceRobotCdr = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'voice_robot_cdr', timestamps: false, freezeTableName: true })
], VoiceRobotCdr);
//# sourceMappingURL=voice-robot-cdr.model.js.map