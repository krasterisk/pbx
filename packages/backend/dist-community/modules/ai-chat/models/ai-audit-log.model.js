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
exports.CcAiAuditLog = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Tool-call audit trail. One row per MCP tool invocation by an AI agent
 * (also mirrored to `cc_ai_cdr.tool_calls` JSON for the in-session view).
 * Owned by existing PBX chat, not the commercial robot product module.
 */
let CcAiAuditLog = class CcAiAuditLog extends sequelize_typescript_1.Model {
};
exports.CcAiAuditLog = CcAiAuditLog;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.BIGINT }),
    __metadata("design:type", Number)
], CcAiAuditLog.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true }),
    __metadata("design:type", String)
], CcAiAuditLog.prototype, "call_uniqueid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], CcAiAuditLog.prototype, "thread_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], CcAiAuditLog.prototype, "agent_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: false }),
    __metadata("design:type", String)
], CcAiAuditLog.prototype, "tool_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], CcAiAuditLog.prototype, "args", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], CcAiAuditLog.prototype, "result", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcAiAuditLog.prototype, "duration_ms", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('ok', 'error', 'rate_limited', 'denied'),
        allowNull: false,
        defaultValue: 'ok',
    }),
    __metadata("design:type", String)
], CcAiAuditLog.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false, defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], CcAiAuditLog.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], CcAiAuditLog.prototype, "user_uid", void 0);
exports.CcAiAuditLog = CcAiAuditLog = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'cc_ai_audit_log', timestamps: false })
], CcAiAuditLog);
//# sourceMappingURL=ai-audit-log.model.js.map