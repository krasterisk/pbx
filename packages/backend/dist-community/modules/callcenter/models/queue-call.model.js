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
exports.CcQueueCall = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Full queue-call history row (answered / abandoned / transferred / …).
 * Written by CallCenterHistoryWriterService (batched bulkCreate).
 * Foundation for reports, metrics, wallboard sparklines (Phase 07).
 */
let CcQueueCall = class CcQueueCall extends sequelize_typescript_1.Model {
};
exports.CcQueueCall = CcQueueCall;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.BIGINT }),
    __metadata("design:type", Number)
], CcQueueCall.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], CcQueueCall.prototype, "call_uniqueid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], CcQueueCall.prototype, "queue_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcQueueCall.prototype, "agent_interface", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], CcQueueCall.prototype, "agent_user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: false, defaultValue: '' }),
    __metadata("design:type", String)
], CcQueueCall.prototype, "caller_id_num", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcQueueCall.prototype, "caller_id_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Date)
], CcQueueCall.prototype, "enter_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Date)
], CcQueueCall.prototype, "answer_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Date)
], CcQueueCall.prototype, "end_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcQueueCall.prototype, "wait_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcQueueCall.prototype, "talk_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcQueueCall.prototype, "hold_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcQueueCall.prototype, "wrapup_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('answered', 'abandoned', 'transferred', 'timeout', 'other'),
        allowNull: false,
        defaultValue: 'other',
    }),
    __metadata("design:type", String)
], CcQueueCall.prototype, "disposition", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcQueueCall.prototype, "transfer_destination", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcQueueCall.prototype, "position", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false, defaultValue: 'inbound' }),
    __metadata("design:type", String)
], CcQueueCall.prototype, "direction", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], CcQueueCall.prototype, "call_type", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false, defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], CcQueueCall.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], CcQueueCall.prototype, "user_uid", void 0);
exports.CcQueueCall = CcQueueCall = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'cc_queue_calls', timestamps: false })
], CcQueueCall);
//# sourceMappingURL=queue-call.model.js.map