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
exports.AgentThreadMessage = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * One message in a persisted chat-agent conversation (D-26).
 * `vpbx_user_uid` is denormalized so every query filters by tenant without a join.
 */
let AgentThreadMessage = class AgentThreadMessage extends sequelize_typescript_1.Model {
};
exports.AgentThreadMessage = AgentThreadMessage;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.BIGINT }),
    __metadata("design:type", Number)
], AgentThreadMessage.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AgentThreadMessage.prototype, "thread_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AgentThreadMessage.prototype, "vpbx_user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false }),
    __metadata("design:type", String)
], AgentThreadMessage.prototype, "role", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentThreadMessage.prototype, "content", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentThreadMessage.prototype, "tool_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentThreadMessage.prototype, "tool_calls", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.CHAR(36), allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentThreadMessage.prototype, "proposal_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentThreadMessage.prototype, "tool_call_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentThreadMessage.prototype, "provider_model", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentThreadMessage.prototype, "close_kind", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false, defaultValue: 'public' }),
    __metadata("design:type", String)
], AgentThreadMessage.prototype, "visibility", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentThreadMessage.prototype, "reasoning", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], AgentThreadMessage.prototype, "tokens_in", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], AgentThreadMessage.prototype, "tokens_out", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false, defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], AgentThreadMessage.prototype, "created_at", void 0);
exports.AgentThreadMessage = AgentThreadMessage = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ai_agent_thread_messages', timestamps: false, freezeTableName: true })
], AgentThreadMessage);
//# sourceMappingURL=agent-thread-message.model.js.map