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
exports.CcAgentEvent = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
let CcAgentEvent = class CcAgentEvent extends sequelize_typescript_1.Model {
};
exports.CcAgentEvent = CcAgentEvent;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.BIGINT }),
    __metadata("design:type", Number)
], CcAgentEvent.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], CcAgentEvent.prototype, "session_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], CcAgentEvent.prototype, "user_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('LOGIN', 'LOGOUT', 'READY', 'PAUSE', 'CALL_START', 'CALL_END', 'WRAPUP_START', 'WRAPUP_END', 'HOLD', 'UNHOLD', 
        /** Phase 9 (D-09/D-13): dialing/consultation/after-call-work timeline events. */
        'DIALING', 'CONSULT', 'ACW'),
        allowNull: false,
    }),
    __metadata("design:type", String)
], CcAgentEvent.prototype, "event_type", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcAgentEvent.prototype, "reason", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcAgentEvent.prototype, "call_uniqueid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcAgentEvent.prototype, "caller_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcAgentEvent.prototype, "queue_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcAgentEvent.prototype, "duration", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true, defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], CcAgentEvent.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], CcAgentEvent.prototype, "user_uid", void 0);
exports.CcAgentEvent = CcAgentEvent = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'cc_agent_events', timestamps: false })
], CcAgentEvent);
//# sourceMappingURL=agent-event.model.js.map