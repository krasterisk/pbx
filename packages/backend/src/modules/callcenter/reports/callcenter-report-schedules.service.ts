import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CcReportSchedule } from '../models/report-schedule.model';
import { NotificationsService } from '../../notifications/notifications.service';
import { CallCenterReportDeliveryService } from './callcenter-report-delivery.service';
import {
  CreateReportScheduleDto,
  UpdateReportScheduleDto,
} from './dto/report-schedule.dto';

export type ScheduleTiming = {
  frequency: 'daily' | 'weekly' | 'monthly';
  hour: number;
  minute: number;
  day_of_week?: number | null;
  day_of_month?: number | null;
};

/**
 * Next run after `from` for a fixed frequency enum (not arbitrary cron).
 * Exported for scheduler reuse without circular DI.
 */
export function computeNextRun(schedule: ScheduleTiming, from = new Date()): Date {
  const hour = schedule.hour ?? 8;
  const minute = schedule.minute ?? 0;

  const candidate = new Date(from);
  candidate.setSeconds(0, 0);

  const setTime = (d: Date) => {
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

@Injectable()
export class CallCenterReportSchedulesService {
  private readonly logger = new Logger(CallCenterReportSchedulesService.name);

  constructor(
    @InjectModel(CcReportSchedule)
    private readonly model: typeof CcReportSchedule,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(vpbx: number): Promise<CcReportSchedule[]> {
    return this.model.findAll({
      where: { user_uid: vpbx },
      order: [['uid', 'DESC']],
    });
  }

  async findOne(uid: number, vpbx: number): Promise<CcReportSchedule> {
    const row = await this.model.findOne({ where: { uid, user_uid: vpbx } });
    if (!row) throw new NotFoundException('Report schedule not found');
    return row;
  }

  async create(dto: CreateReportScheduleDto, vpbx: number): Promise<CcReportSchedule> {
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
    } as any);
  }

  async update(
    uid: number,
    dto: UpdateReportScheduleDto,
    vpbx: number,
  ): Promise<CcReportSchedule> {
    const row = await this.findOne(uid, vpbx);

    if (dto.integration_uid != null) {
      await this.notificationsService.findOne(dto.integration_uid, vpbx);
    }

    const timingChanged =
      dto.frequency != null ||
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
              frequency: (dto.frequency ?? row.frequency) as ScheduleTiming['frequency'],
              hour: dto.hour ?? row.hour,
              minute: dto.minute ?? row.minute,
              day_of_week: dto.day_of_week !== undefined ? dto.day_of_week : row.day_of_week,
              day_of_month:
                dto.day_of_month !== undefined ? dto.day_of_month : row.day_of_month,
            }),
          }
        : {}),
    });

    return row.reload();
  }

  async remove(uid: number, vpbx: number): Promise<{ success: boolean }> {
    const row = await this.findOne(uid, vpbx);
    await row.destroy();
    return { success: true };
  }

  async runNow(
    uid: number,
    vpbx: number,
    delivery: CallCenterReportDeliveryService,
  ): Promise<{ success: boolean; error?: string }> {
    const row = await this.findOne(uid, vpbx);
    return delivery.deliverSchedule(row);
  }
}
