import { Injectable, Logger, Optional } from '@nestjs/common';
import { shiftDateKey, zonedDateKey } from '@krasterisk/shared';
import { CallCenterReportsService } from './callcenter-reports.service';
import { CallCenterMetricsConfigService } from '../callcenter-metrics-config.service';
import { buildReportCsv } from './exporters/csv-exporter';
import { buildReportXlsx } from './exporters/xlsx-exporter';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationDispatcherService } from '../../notifications/notification-dispatcher.service';
import {
  trimNotificationMessage,
} from '../../notifications/providers/notification-provider.interface';
import { MailerService } from '../../mailer/mailer.service';
import { CcReportSchedule } from '../models/report-schedule.model';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PeriodPreset =
  | 'today'
  | 'yesterday'
  | 'last-7-days'
  | 'last-30-days'
  | 'previous-month';

/**
 * Generate a tenant-scoped CC report and deliver via notification_integration (D-35).
 * Email → file attachment (csv/xlsx). Messenger → text summary only (no file in v1).
 */
@Injectable()
export class CallCenterReportDeliveryService {
  private readonly logger = new Logger(CallCenterReportDeliveryService.name);

  constructor(
    private readonly reportsService: CallCenterReportsService,
    private readonly notificationsService: NotificationsService,
    private readonly dispatcherService: NotificationDispatcherService,
    private readonly mailerService: MailerService,
    @Optional() private readonly config?: CallCenterMetricsConfigService,
  ) {}

  /**
   * Resolve a sliding period window relative to now (bounded presets, T-07-15-03).
   * Public for unit tests.
   */
  /**
   * Tenant-local calendar dates (`YYYY-MM-DD`). The report engine treats a date-only bound
   * as the whole local day, so a schedule is not shifted by the server timezone.
   */
  resolvePeriod(preset: PeriodPreset, now = new Date(), timezone = 'UTC'): { dateFrom: string; dateTo: string } {
    const today = zonedDateKey(now, timezone);
    const monthOf = (key: string, deltaMonths: number): { from: string; to: string } => {
      const [year, month] = key.split('-').map(Number);
      const start = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
      const end = new Date(Date.UTC(year, month + deltaMonths, 0));
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      return { from: fmt(start), to: fmt(end) };
    };
    switch (preset) {
      case 'today':
        return { dateFrom: today, dateTo: today };
      case 'yesterday': {
        const day = shiftDateKey(today, -1);
        return { dateFrom: day, dateTo: day };
      }
      case 'last-7-days':
        return { dateFrom: shiftDateKey(today, -6), dateTo: today };
      case 'last-30-days':
        return { dateFrom: shiftDateKey(today, -29), dateTo: today };
      case 'previous-month': {
        const prev = monthOf(today, -1);
        return { dateFrom: prev.from, dateTo: prev.to };
      }
      default: {
        const day = shiftDateKey(today, -1);
        return { dateFrom: day, dateTo: day };
      }
    }
  }

  async deliverSchedule(
    schedule: CcReportSchedule,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Delivery target authz (T-07-15-02): findByUidInternal has no tenant filter
      const integ = await this.notificationsService.findByUidInternal(
        schedule.integration_uid,
      );
      if (integ.user_uid !== schedule.user_uid) {
        this.logger.warn(
          `integration_tenant_mismatch schedule=${schedule.uid} integ=${schedule.integration_uid}`,
        );
        return { success: false, error: 'integration_tenant_mismatch' };
      }

      let timezone = 'UTC';
      if (this.config) {
        timezone = (await this.config.getTenantConfig(schedule.user_uid)).timezone || 'UTC';
      }
      const resolvedPeriod = this.resolvePeriod(
        schedule.period_preset as PeriodPreset,
        new Date(),
        timezone,
      );
      const filters = (schedule.filters ?? {}) as {
        queueName?: string;
        agentInterface?: string;
        agentUserUid?: string;
      };
      const dto = {
        ...resolvedPeriod,
        queueName: filters.queueName,
        agentInterface: filters.agentInterface,
        agentUserUid: filters.agentUserUid,
      };

      // runReport(reportId, vpbxUserUid, query) — tenant-scoped via schedule.user_uid
      const result = await this.reportsService.runReport(
        schedule.report_id,
        schedule.user_uid,
        dto,
      );

      const periodLabel = `${resolvedPeriod.dateFrom.slice(0, 10)}…${resolvedPeriod.dateTo.slice(0, 10)}`;
      const vars: Record<string, string> = {
        report: schedule.report_id,
        period: periodLabel,
      };
      const subject = this.applyTemplate(
        schedule.subject_template || `CC report: {{report}} ({{period}})`,
        vars,
      );
      const text = this.applyTemplate(
        schedule.message_template ||
          `Call center report «{{report}}» for {{period}}.`,
        vars,
      );

      if (integ.channel === 'email') {
        const to = (schedule.target || (integ.config as { to?: string } | null)?.to || '').trim();
        if (!to) {
          return { success: false, error: 'missing_target' };
        }
        if (!EMAIL_RE.test(to)) {
          return { success: false, error: 'invalid_email_target' };
        }

        const dateStamp = resolvedPeriod.dateTo.slice(0, 10);
        if (schedule.format === 'xlsx') {
          const content = await buildReportXlsx(
            schedule.report_id,
            result.columns,
            result.rows,
            result.timezone,
          );
          const mailRes = await this.mailerService.sendReportMail({
            to,
            subject,
            text,
            attachment: {
              filename: `cc_${schedule.report_id}_${dateStamp}.xlsx`,
              content,
              contentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          });
          return mailRes.success
            ? { success: true }
            : { success: false, error: 'mail_send_failed' };
        }

        const csv = buildReportCsv(result.columns, result.rows, result.timezone);
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
      const summary = trimNotificationMessage(
        [
          `CC report: ${schedule.report_id}`,
          `Period: ${periodLabel}`,
          `Rows: ${result.rows?.length ?? 0}`,
          result.rows?.[0]
            ? `Sample: ${JSON.stringify(result.rows[0]).slice(0, 200)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
      await this.dispatcherService.dispatch({
        integration_uid: schedule.integration_uid,
        message: summary,
        target: schedule.target ?? undefined,
      });
      return { success: true };
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      this.logger.error(`deliverSchedule failed schedule=${schedule.uid}: ${msg}`);
      return { success: false, error: msg.slice(0, 512) };
    }
  }

  private applyTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
      vars[key] !== undefined ? vars[key] : '',
    );
  }
}
