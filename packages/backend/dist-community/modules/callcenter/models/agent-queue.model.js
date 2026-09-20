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
exports.CcAgentQueue = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Persistent agent-to-queue assignment (configuration).
 * Used to remember which queues an agent should join on login.
 * Also stores penalty (priority) for each queue assignment.
 */
let CcAgentQueue = class CcAgentQueue extends sequelize_typescript_1.Model {
};
exports.CcAgentQueue = CcAgentQueue;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], CcAgentQueue.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], CcAgentQueue.prototype, "user_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], CcAgentQueue.prototype, "agent_interface", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], CcAgentQueue.prototype, "queue_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcAgentQueue.prototype, "penalty", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcAgentQueue.prototype, "user_uid", void 0);
exports.CcAgentQueue = CcAgentQueue = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'cc_agent_queues', timestamps: false })
], CcAgentQueue);
//# sourceMappingURL=agent-queue.model.js.map