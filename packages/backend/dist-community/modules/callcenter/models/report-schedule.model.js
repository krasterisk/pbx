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
exports.CcReportSchedule = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Scheduled call-center report delivery (D-35).
 * Cron tick finds enabled rows with next_run_at <= now and delivers via notification_integration.
 */
let CcReportSchedule = class CcReportSchedule extends sequelize_typescript_1.Model {
};
exports.CcReportSchedule = CcReportSchedule;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.BIGINT }),
    __metadata("design:type", Number)
], CcReportSchedule.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: false }),
    __metadata("design:type", String)
], CcReportSchedule.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: false }),
    __metadata("design:type", String)
], CcReportSchedule.prototype, "report_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('csv', 'xlsx'),
        allowNull: false,
        defaultValue: 'xlsx',
    }),
    __metadata("design:type", String)
], CcReportSchedule.prototype, "format", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('today', 'yesterday', 'last-7-days', 'last-30-days', 'previous-month'),
        allowNull: false,
        defaultValue: 'yesterday',
    }),
    __metadata("design:type", String)
], CcReportSchedule.prototype, "period_preset", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], CcReportSchedule.prototype, "filters", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('daily', 'weekly', 'monthly'),
        allowNull: false,
        defaultValue: 'daily',
    }),
    __metadata("design:type", String)
], CcReportSchedule.prototype, "frequency", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 8 }),
    __metadata("design:type", Number)
], CcReportSchedule.prototype, "hour", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], CcReportSchedule.prototype, "minute", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Object)
], CcReportSchedule.prototype, "day_of_week", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Object)
], CcReportSchedule.prototype, "day_of_month", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], CcReportSchedule.prototype, "integration_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(256), allowNull: true }),
    __metadata("design:type", Object)
], CcReportSchedule.prototype, "target", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(256), allowNull: true }),
    __metadata("design:type", Object)
], CcReportSchedule.prototype, "subject_template", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", Object)
], CcReportSchedule.prototype, "message_template", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: true }),
    __metadata("design:type", Boolean)
], CcReportSchedule.prototype, "enabled", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], CcReportSchedule.prototype, "last_run_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: true }),
    __metadata("design:type", Object)
], CcReportSchedule.prototype, "last_status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(512), allowNull: true }),
    __metadata("design:type", Object)
], CcReportSchedule.prototype, "last_error", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], CcReportSchedule.prototype, "next_run_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], CcReportSchedule.prototype, "user_uid", void 0);
exports.CcReportSchedule = CcReportSchedule = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'cc_report_schedules', timestamps: false })
], CcReportSchedule);
//# sourceMappingURL=report-schedule.model.js.map