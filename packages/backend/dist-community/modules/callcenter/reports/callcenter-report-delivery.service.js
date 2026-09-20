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
var CallCenterReportDeliveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterReportDeliveryService = void 0;
const common_1 = require("@nestjs/common");
const callcenter_reports_service_1 = require("./callcenter-reports.service");
const csv_exporter_1 = require("./exporters/csv-exporter");
const xlsx_exporter_1 = require("./exporters/xlsx-exporter");
const notifications_service_1 = require("../../notifications/notifications.service");
const notification_dispatcher_service_1 = require("../../notifications/notification-dispatcher.service");
const notification_provider_interface_1 = require("../../notifications/providers/notification-provider.interface");
const mailer_service_1 = require("../../mailer/mailer.service");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/**
 * Generate a tenant-scoped CC report and deliver via notification_integration (D-35).
 * Email → file attachment (csv/xlsx). Messenger → text summary only (no file in v1).
 */
let CallCenterReportDeliveryService = CallCenterReportDeliveryService_1 = class CallCenterReportDeliveryService {
    reportsService;
    notificationsService;
    dispatcherService;
    mailerService;
    logger = new common_1.Logger(CallCenterReportDeliveryService_1.name);
    constructor(reportsService, notificationsService, dispatcherService, mailerService) {
        this.reportsService = reportsService;
        this.notificationsService = notificationsService;
        this.dispatcherService = dispatcherService;
        this.mailerService = mailerService;
    }
    /**
     * Resolve a sliding period window relative to now (bounded presets, T-07-15-03).
     * Public for unit tests.
     */
    resolvePeriod(preset, now = new Date()) {
        const startOfDay = (d) => {
            const x = new Date(d);
            x.setHours(0, 0, 0, 0);
            return x;
        };
        const endOfDay = (d) => {
            const x = new Date(d);
            x.setHours(23, 59, 59, 999);
            return x;
        };
        const toIso = (d) => d.toISOString();
        switch (preset) {
            case 'today': {
                return { dateFrom: toIso(startOfDay(now)), dateTo: toIso(endOfDay(now)) };
            }
            case 'yesterday': {
                const y = new Date(now);
                y.setDate(y.getDate() - 1);
                return { dateFrom: toIso(startOfDay(y)), dateTo: toIso(endOfDay(y)) };
            }
            case 'last-7-days': {
                const from = startOfDay(now);
                from.setDate(from.getDate() - 6);
                return { dateFrom: toIso(from), dateTo: toIso(endOfDay(now)) };
            }
            case 'last-30-days': {
                const from = startOfDay(now);
                from.setDate(from.getDate() - 29);
                return { dateFrom: toIso(from), dateTo: toIso(endOfDay(now)) };
            }
            case 'previous-month': {
                const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const lastPrev = new Date(firstThisMonth);
                lastPrev.setDate(0);
                const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
                return { dateFrom: toIso(startOfDay(firstPrev)), dateTo: toIso(endOfDay(lastPrev)) };
            }
            default: {
                const y = new Date(now);
                y.setDate(y.getDate() - 1);
                return { dateFrom: toIso(startOfDay(y)), dateTo: toIso(endOfDay(y)) };
            }
        }
    }
    async deliverSchedule(schedule) {
        try {
            // Delivery target authz (T-07-15-02): findByUidInternal has no tenant filter
            const integ = await this.notificationsService.findByUidInternal(schedule.integration_uid);
            if (integ.user_uid !== schedule.user_uid) {
                this.logger.warn(`integration_tenant_mismatch schedule=${schedule.uid} integ=${schedule.integration_uid}`);
                return { success: false, error: 'integration_tenant_mismatch' };
            }
            const resolvedPeriod = this.resolvePeriod(schedule.period_preset);
            const filters = schedule.filters ?? {};
            const dto = {
                ...resolvedPeriod,
                queueName: filters.queueName,
                agentInterface: filters.agentInterface,
            };
            // runReport(reportId, vpbxUserUid, query) — tenant-scoped via schedule.user_uid
            const result = await this.reportsService.runReport(schedule.report_id, schedule.user_uid, dto);
            const periodLabel = `${resolvedPeriod.dateFrom.slice(0, 10)}…${resolvedPeriod.dateTo.slice(0, 10)}`;
            const vars = {
                report: schedule.report_id,
                period: periodLabel,
            };
            const subject = this.applyTemplate(schedule.subject_template || `CC report: {{report}} ({{period}})`, vars);
            const text = this.applyTemplate(schedule.message_template ||
                `Call center report «{{report}}» for {{period}}.`, vars);
            if (integ.channel === 'email') {
                const to = (schedule.target || integ.config?.to || '').trim();
                if (!to) {
                    return { success: false, error: 'missing_target' };
                }
                if (!EMAIL_RE.test(to)) {
                    return { success: false, error: 'invalid_email_target' };
                }
                const dateStamp = resolvedPeriod.dateTo.slice(0, 10);
                if (schedule.format === 'xlsx') {
                    const content = await (0, xlsx_exporter_1.buildReportXlsx)(schedule.report_id, result.columns, result.rows);
                    const mailRes = await this.mailerService.sendReportMail({
                        to,
                        subject,
                        text,
                        attachment: {
                            filename: `cc_${schedule.report_id}_${dateStamp}.xlsx`,
                            content,
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        },
                    });
                    return mailRes.success
                        ? { success: true }
                        : { success: false, error: 'mail_send_failed' };
                }
                const csv = (0, csv_exporter_1.buildReportCsv)(result.columns, result.rows);
                const mailRes = await this.mailerService.sendReportMail({
                    to,
                    subject,
                    text,
                    attachment: {
                        filename: `cc_${schedule.report_id}_${dateStamp}.csv`,
                        content: csv,
                        contentType: 'text/csv; charset=utf-8',
                    },
                });
                return mailRes.success
                    ? { success: true }
                    : { success: false, error: 'mail_send_failed' };
            }
            // Messenger channels: text summary only (no file attachment in v1)
            const summary = (0, notification_provider_interface_1.trimNotificationMessage)([
                `CC report: ${schedule.report_id}`,
                `Period: ${periodLabel}`,
                `Rows: ${result.rows?.length ?? 0}`,
                result.rows?.[0]
                    ? `Sample: ${JSON.stringify(result.rows[0]).slice(0, 200)}`
                    : '',
            ]
                .filter(Boolean)
                .join('\n'));
            await this.dispatcherService.dispatch({
                integration_uid: schedule.integration_uid,
                message: summary,
                target: schedule.target ?? undefined,
            });
            return { success: true };
        }
        catch (e) {
            const msg = e?.message ?? String(e);
            this.logger.error(`deliverSchedule failed schedule=${schedule.uid}: ${msg}`);
            return { success: false, error: msg.slice(0, 512) };
        }
    }
    applyTemplate(template, vars) {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] !== undefined ? vars[key] : '');
    }
};
exports.CallCenterReportDeliveryService = CallCenterReportDeliveryService;
exports.CallCenterReportDeliveryService = CallCenterReportDeliveryService = CallCenterReportDeliveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [callcenter_reports_service_1.CallCenterReportsService,
        notifications_service_1.NotificationsService,
        notification_dispatcher_service_1.NotificationDispatcherService,
        mailer_service_1.MailerService])
], CallCenterReportDeliveryService);
//# sourceMappingURL=callcenter-report-delivery.service.js.map