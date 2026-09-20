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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CallCenterReportSchedulesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterReportSchedulesService = void 0;
exports.computeNextRun = computeNextRun;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const report_schedule_model_1 = require("../models/report-schedule.model");
const notifications_service_1 = require("../../notifications/notifications.service");
/**
 * Next run after `from` for a fixed frequency enum (not arbitrary cron).
 * Exported for scheduler reuse without circular DI.
 */
function computeNextRun(schedule, from = new Date()) {
    const hour = schedule.hour ?? 8;
    const minute = schedule.minute ?? 0;
    const candidate = new Date(from);
    candidate.setSeconds(0, 0);
    const setTime = (d) => {
        d.setHours(hour, minute, 0, 0);
        return d;
    };
    if (schedule.frequency === 'daily') {
        const next = setTime(new Date(from));
        if (next.getTime() <= from.getTime()) {
            next.setDate(next.getDate() + 1);
        }
        return next;
    }
    if (schedule.frequency === 'weekly') {
        const targetDow = schedule.day_of_week ?? 1; // default Monday
        const next = setTime(new Date(from));
        const currentDow = next.getDay();
        let add = (targetDow - currentDow + 7) % 7;
        if (add === 0 && next.getTime() <= from.getTime()) {
            add = 7;
        }
        next.setDate(next.getDate() + add);
        return next;
    }
    // monthly — day_of_month capped 1-28
    const dom = Math.min(28, Math.max(1, schedule.day_of_month ?? 1));
    const next = setTime(new Date(from.getFullYear(), from.getMonth(), dom));
    if (next.getTime() <= from.getTime()) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(dom);
        setTime(next);
    }
    return next;
}
let CallCenterReportSchedulesService = CallCenterReportSchedulesService_1 = class CallCenterReportSchedulesService {
    model;
    notificationsService;
    logger = new common_1.Logger(CallCenterReportSchedulesService_1.name);
    constructor(model, notificationsService) {
        this.model = model;
        this.notificationsService = notificationsService;
    }
    async findAll(vpbx) {
        return this.model.findAll({
            where: { user_uid: vpbx },
            order: [['uid', 'DESC']],
        });
    }
    async findOne(uid, vpbx) {
        const row = await this.model.findOne({ where: { uid, user_uid: vpbx } });
        if (!row)
            throw new common_1.NotFoundException('Report schedule not found');
        return row;
    }
    async create(dto, vpbx) {
        // Confirm integration belongs to tenant (T-07-15-02)
        await this.notificationsService.findOne(dto.integration_uid, vpbx);
        const next_run_at = computeNextRun(dto);
        return this.model.create({
            name: dto.name,
            report_id: dto.report_id,
            format: dto.format,
            period_preset: dto.period_preset,
            filters: dto.filters ?? null,
            frequency: dto.frequency,
            hour: dto.hour,
            minute: dto.minute,
            day_of_week: dto.day_of_week ?? null,
            day_of_month: dto.day_of_month ?? null,
            integration_uid: dto.integration_uid,
            target: dto.target ?? null,
            subject_template: dto.subject_template ?? null,
            message_template: dto.message_template ?? null,
            enabled: dto.enabled ?? true,
            next_run_at,
            user_uid: vpbx,
        });
    }
    async update(uid, dto, vpbx) {
        const row = await this.findOne(uid, vpbx);
        if (dto.integration_uid != null) {
            await this.notificationsService.findOne(dto.integration_uid, vpbx);
        }
        const timingChanged = dto.frequency != null ||
            dto.hour != null ||
            dto.minute != null ||
            dto.day_of_week !== undefined ||
            dto.day_of_month !== undefined;
        await row.update({
            ...(dto.name != null ? { name: dto.name } : {}),
            ...(dto.report_id != null ? { report_id: dto.report_id } : {}),
            ...(dto.format != null ? { format: dto.format } : {}),
            ...(dto.period_preset != null ? { period_preset: dto.period_preset } : {}),
            ...(dto.filters !== undefined ? { filters: dto.filters ?? null } : {}),
            ...(dto.frequency != null ? { frequency: dto.frequency } : {}),
            ...(dto.hour != null ? { hour: dto.hour } : {}),
            ...(dto.minute != null ? { minute: dto.minute } : {}),
            ...(dto.day_of_week !== undefined ? { day_of_week: dto.day_of_week } : {}),
            ...(dto.day_of_month !== undefined ? { day_of_month: dto.day_of_month } : {}),
            ...(dto.integration_uid != null ? { integration_uid: dto.integration_uid } : {}),
            ...(dto.target !== undefined ? { target: dto.target } : {}),
            ...(dto.subject_template !== undefined
                ? { subject_template: dto.subject_template }
                : {}),
            ...(dto.message_template !== undefined
                ? { message_template: dto.message_template }
                : {}),
            ...(dto.enabled != null ? { enabled: dto.enabled } : {}),
            ...(timingChanged
                ? {
                    next_run_at: computeNextRun({
                        frequency: (dto.frequency ?? row.frequency),
                        hour: dto.hour ?? row.hour,
                        minute: dto.minute ?? row.minute,
                        day_of_week: dto.day_of_week !== undefined ? dto.day_of_week : row.day_of_week,
                        day_of_month: dto.day_of_month !== undefined ? dto.day_of_month : row.day_of_month,
                    }),
                }
                : {}),
        });
        return row.reload();
    }
    async remove(uid, vpbx) {
        const row = await this.findOne(uid, vpbx);
        await row.destroy();
        return { success: true };
    }
    async runNow(uid, vpbx, delivery) {
        const row = await this.findOne(uid, vpbx);
        return delivery.deliverSchedule(row);
    }
};
exports.CallCenterReportSchedulesService = CallCenterReportSchedulesService;
exports.CallCenterReportSchedulesService = CallCenterReportSchedulesService = CallCenterReportSchedulesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(report_schedule_model_1.CcReportSchedule)),
    __metadata("design:paramtypes", [Object, notifications_service_1.NotificationsService])
], CallCenterReportSchedulesService);
//# sourceMappingURL=callcenter-report-schedules.service.js.map