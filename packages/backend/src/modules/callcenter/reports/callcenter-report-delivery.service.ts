import { Injectable, Logger } from '@nestjs/common';
import { CallCenterReportsService } from './callcenter-reports.service';
import type { CcReportId } from './callcenter-reports.types';
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
  ) {}

  /**
   * Resolve a sliding period window relative to now (bounded presets, T-07-15-03).
   * Public for unit tests.
   */
  resolvePeriod(preset: PeriodPreset, now = new Date()): { dateFrom: string; dateTo: string } {
    const startOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const endOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(23, 59, 59, 999);
      return x;
    };
    const toIso = (d: Date) => d.toISOString();

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

      const resolvedPeriod = this.resolvePeriod(
        schedule.period_preset as PeriodPreset,
      );
      const filters = schedule.filters ?? {};
      const dto = {
        ...resolvedPeriod,
        queueName: filters.queueName,
        agentInterface: filters.agentInterface,
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

        const csv = buildReportCsv(result.columns, result.rows);
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
