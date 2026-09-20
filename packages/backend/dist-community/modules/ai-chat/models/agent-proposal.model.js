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
exports.AgentProposal = exports.AGENT_PROPOSAL_STATUSES = void 0;
const crypto_1 = require("crypto");
const sequelize_typescript_1 = require("sequelize-typescript");
exports.AGENT_PROPOSAL_STATUSES = ['pending', 'applied', 'rejected', 'denied', 'expired'];
/**
 * Pending change proposal for the confirmation card (D-18 / 15-05).
 *
 * `apply_payload` is server-side only — never serialized to the model or the browser (T-15-07).
 * Status vocabulary matches the UI-contract card badges one for one.
 */
let AgentProposal = class AgentProposal extends sequelize_typescript_1.Model {
};
exports.AgentProposal = AgentProposal;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, type: sequelize_typescript_1.DataType.CHAR(36), defaultValue: () => (0, crypto_1.randomUUID)() }),
    __metadata("design:type", String)
], AgentProposal.prototype, "proposal_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AgentProposal.prototype, "thread_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AgentProposal.prototype, "vpbx_user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AgentProposal.prototype, "user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], AgentProposal.prototype, "entity_type", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false }),
    __metadata("design:type", String)
], AgentProposal.prototype, "entity_label", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Array)
], AgentProposal.prototype, "summary", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentProposal.prototype, "before_json", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentProposal.prototype, "after_json", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Object)
], AgentProposal.prototype, "apply_payload", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: false }),
    __metadata("design:type", Boolean)
], AgentProposal.prototype, "includes_dialplan_reload", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false, defaultValue: 'pending' }),
    __metadata("design:type", String)
], AgentProposal.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentProposal.prototype, "error", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false }),
    __metadata("design:type", Date)
], AgentProposal.prototype, "expires_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentProposal.prototype, "applied_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false, defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], AgentProposal.prototype, "created_at", void 0);
exports.AgentProposal = AgentProposal = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ai_agent_proposals', timestamps: false, freezeTableName: true })
], AgentProposal);
//# sourceMappingURL=agent-proposal.model.js.map