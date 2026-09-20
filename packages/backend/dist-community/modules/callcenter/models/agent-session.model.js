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
exports.CcAgentSession = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
let CcAgentSession = class CcAgentSession extends sequelize_typescript_1.Model {
};
exports.CcAgentSession = CcAgentSession;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], CcAgentSession.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], CcAgentSession.prototype, "user_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], CcAgentSession.prototype, "agent_interface", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true, defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], CcAgentSession.prototype, "login_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Date)
], CcAgentSession.prototype, "logout_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcAgentSession.prototype, "total_calls", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcAgentSession.prototype, "total_talk_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcAgentSession.prototype, "total_pause_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcAgentSession.prototype, "total_idle_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: true }),
    __metadata("design:type", Object)
], CcAgentSession.prototype, "last_status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], CcAgentSession.prototype, "last_status_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", Object)
], CcAgentSession.prototype, "pause_reason", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: true }),
    __metadata("design:type", Object)
], CcAgentSession.prototype, "last_status_origin", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], CcAgentSession.prototype, "queues_snapshot", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: true }),
    __metadata("design:type", Object)
], CcAgentSession.prototype, "softphone_mode", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], CcAgentSession.prototype, "panel_seen_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: true }),
    __metadata("design:type", Object)
], CcAgentSession.prototype, "close_reason", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], CcAgentSession.prototype, "user_uid", void 0);
exports.CcAgentSession = CcAgentSession = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'cc_agent_sessions', timestamps: false })
], CcAgentSession);
//# sourceMappingURL=agent-session.model.js.map