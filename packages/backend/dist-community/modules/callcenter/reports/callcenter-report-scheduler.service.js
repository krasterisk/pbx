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
var CallCenterReportSchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterReportSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const report_schedule_model_1 = require("../models/report-schedule.model");
const callcenter_report_delivery_service_1 = require("./callcenter-report-delivery.service");
const callcenter_report_schedules_service_1 = require("./callcenter-report-schedules.service");
/** Max schedules processed per cron tick (T-07-15-03). */
const MAX_PER_TICK = 50;
/**
 * Periodic tick for due report schedules (D-35).
 * Relies on app-wide ScheduleModule.forRoot() (billing.module) — do NOT call forRoot here.
 */
let CallCenterReportSchedulerService = CallCenterReportSchedulerService_1 = class CallCenterReportSchedulerService {
    model;
    delivery;
    logger = new common_1.Logger(CallCenterReportSchedulerService_1.name);
    constructor(model, delivery) {
        this.model = model;
        this.delivery = delivery;
    }
    async runDueSchedules() {
        const now = new Date();
        let processed = 0;
        let errors = 0;
        try {
            const due = await this.model.findAll({
                where: {
                    enabled: true,
                    next_run_at: { [sequelize_2.Op.lte]: now },
                },
                order: [['next_run_at', 'ASC']],
                limit: MAX_PER_TICK,
            });
            for (const schedule of due) {
                try {
                    const res = await this.delivery.deliverSchedule(schedule);
                    await schedule.update({
                        last_run_at: now,
                        last_status: res.success ? 'ok' : 'error',
                        last_error: res.error ?? null,
                        next_run_at: (0, callcenter_report_schedules_service_1.computeNextRun)(schedule, now),
                    });
                    processed += 1;
                    if (!res.success)
                        errors += 1;
                }
                catch (e) {
                    errors += 1;
                    this.logger.error(`runDueSchedules item ${schedule.uid}: ${e.message}`);
                    try {
                        await schedule.update({
                            last_run_at: now,
                            last_status: 'error',
                            last_error: (e.message ?? 'unknown').slice(0, 512),
                            next_run_at: (0, callcenter_report_schedules_service_1.computeNextRun)(schedule, now),
                        });
                    }
                    catch {
                        /* ignore secondary update failure */
                    }
                }
            }
            if (processed > 0 || errors > 0) {
                this.logger.log(`[report-schedules] tick done processed=${processed} errors=${errors}`);
            }
        }
        catch (e) {
            this.logger.error(`runDueSchedules failed: ${e.message}`);
        }
    }
};
exports.CallCenterReportSchedulerService = CallCenterReportSchedulerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_10_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CallCenterReportSchedulerService.prototype, "runDueSchedules", null);
exports.CallCenterReportSchedulerService = CallCenterReportSchedulerService = CallCenterReportSchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(report_schedule_model_1.CcReportSchedule)),
    __metadata("design:paramtypes", [Object, callcenter_report_delivery_service_1.CallCenterReportDeliveryService])
], CallCenterReportSchedulerService);
//# sourceMappingURL=callcenter-report-scheduler.service.js.map