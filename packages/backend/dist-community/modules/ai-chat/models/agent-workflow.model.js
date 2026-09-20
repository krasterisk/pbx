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
exports.AgentWorkflowStep = exports.AgentWorkflow = exports.AGENT_WORKFLOW_STEP_STATUSES = exports.AGENT_WORKFLOW_STATUSES = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
exports.AGENT_WORKFLOW_STATUSES = [
    'pending',
    'applying',
    'applied',
    'failed',
    'rejected',
    'denied',
    'expired',
];
exports.AGENT_WORKFLOW_STEP_STATUSES = [
    'pending',
    'applying',
    'applied',
    'failed',
    'skipped',
];
/**
 * Multi-step staged HITL plan. A single mutation is represented as a one-step
 * workflow; the legacy proposal API remains a compatibility view over that.
 */
let AgentWorkflow = class AgentWorkflow extends sequelize_typescript_1.Model {
};
exports.AgentWorkflow = AgentWorkflow;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], AgentWorkflow.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.CHAR(36), allowNull: false, unique: true }),
    __metadata("design:type", String)
], AgentWorkflow.prototype, "workflow_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AgentWorkflow.prototype, "thread_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AgentWorkflow.prototype, "vpbx_user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AgentWorkflow.prototype, "user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], AgentWorkflow.prototype, "brief_version", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], AgentWorkflow.prototype, "title", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false, defaultValue: [] }),
    __metadata("design:type", Array)
], AgentWorkflow.prototype, "summary", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false, defaultValue: 'pending' }),
    __metadata("design:type", String)
], AgentWorkflow.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentWorkflow.prototype, "error", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false }),
    __metadata("design:type", Date)
], AgentWorkflow.prototype, "expires_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentWorkflow.prototype, "applied_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false, defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], AgentWorkflow.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false, defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], AgentWorkflow.prototype, "updated_at", void 0);
exports.AgentWorkflow = AgentWorkflow = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ai_agent_workflows', timestamps: false, freezeTableName: true })
], AgentWorkflow);
let AgentWorkflowStep = class AgentWorkflowStep extends sequelize_typescript_1.Model {
};
exports.AgentWorkflowStep = AgentWorkflowStep;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], AgentWorkflowStep.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AgentWorkflowStep.prototype, "workflow_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], AgentWorkflowStep.prototype, "step_key", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], AgentWorkflowStep.prototype, "step_index", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: false }),
    __metadata("design:type", String)
], AgentWorkflowStep.prototype, "tool", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], AgentWorkflowStep.prototype, "entity_type", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], AgentWorkflowStep.prototype, "entity_label", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false, defaultValue: [] }),
    __metadata("design:type", Array)
], AgentWorkflowStep.prototype, "depends_on", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Object)
], AgentWorkflowStep.prototype, "canonical_args", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], AgentWorkflowStep.prototype, "schema_version", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentWorkflowStep.prototype, "before_json", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentWorkflowStep.prototype, "after_json", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentWorkflowStep.prototype, "result_json", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false, defaultValue: 'pending' }),
    __metadata("design:type", String)
], AgentWorkflowStep.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], AgentWorkflowStep.prototype, "attempts", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AgentWorkflowStep.prototype, "error", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: false }),
    __metadata("design:type", Boolean)
], AgentWorkflowStep.prototype, "requires_secure_input", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false, defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], AgentWorkflowStep.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false, defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], AgentWorkflowStep.prototype, "updated_at", void 0);
exports.AgentWorkflowStep = AgentWorkflowStep = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ai_agent_workflow_steps', timestamps: false, freezeTableName: true })
], AgentWorkflowStep);
//# sourceMappingURL=agent-workflow.model.js.map