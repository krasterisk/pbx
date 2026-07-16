import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CcReportSchedule } from '../models/report-schedule.model';
import { CallCenterReportDeliveryService } from './callcenter-report-delivery.service';
import { computeNextRun } from './callcenter-report-schedules.service';

/** Max schedules processed per cron tick (T-07-15-03). */
const MAX_PER_TICK = 50;

/**
 * Periodic tick for due report schedules (D-35).
 * Relies on app-wide ScheduleModule.forRoot() (billing.module) — do NOT call forRoot here.
 */
@Injectable()
export class CallCenterReportSchedulerService {
  private readonly logger = new Logger(CallCenterReportSchedulerService.name);

  constructor(
    @InjectModel(CcReportSchedule)
    private readonly model: typeof CcReportSchedule,
    private readonly delivery: CallCenterReportDeliveryService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runDueSchedules(): Promise<void> {
    const now = new Date();
    let processed = 0;
    let errors = 0;

    try {
      const due = await this.model.findAll({
        where: {
          enabled: true,
          next_run_at: { [Op.lte]: now },
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
            next_run_at: computeNextRun(schedule, now),
          });
          processed += 1;
          if (!res.success) errors += 1;
        } catch (e) {
          errors += 1;
          this.logger.error(
            `runDueSchedules item ${schedule.uid}: ${(e as Error).message}`,
          );
          try {
            await schedule.update({
              last_run_at: now,
              last_status: 'error',
              last_error: ((e as Error).message ?? 'unknown').slice(0, 512),
              next_run_at: computeNextRun(schedule, now),
            });
          } catch {
            /* ignore secondary update failure */
          }
        }
      }

      if (processed > 0 || errors > 0) {
        this.logger.log(
          `[report-schedules] tick done processed=${processed} errors=${errors}`,
        );
      }
    } catch (e) {
      this.logger.error(`runDueSchedules failed: ${(e as Error).message}`);
    }
  }
}
