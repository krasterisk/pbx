import { Injectable, Logger, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  DEFAULT_CALLBACK_POLICY,
  type CallbackDialOrder,
  type ICallbackPolicy,
} from '@krasterisk/shared';
import { AmiService } from '../ami/ami.service';
import { CallCenterSettingsService, sanitizeCallbackPolicy } from '../callcenter/callcenter-settings.service';
import { CallbackRequest } from './callback-request.model';

const SCAN_INTERVAL_MS = 30_000;
const SCAN_BATCH = 20;
const BACKOFF_MINUTES = [1, 5, 15];

export function isWithinCallbackWindow(
  now: Date,
  windowStart: string,
  windowEnd: string,
): boolean {
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const start = windowStart || '00:00';
  const end = windowEnd || '23:59';
  if (start <= end) return hhmm >= start && hhmm <= end;
  return hhmm >= start || hhmm <= end;
}

@Injectable()
export class CallbackScannerService {
  private readonly logger = new Logger(CallbackScannerService.name);
  private running = false;

  constructor(
    @InjectModel(CallbackRequest) private readonly requests: typeof CallbackRequest,
    @Optional() private readonly settings?: CallCenterSettingsService,
    @Optional() private readonly ami?: AmiService,
  ) {}

  @Interval('cc-callback-scan', SCAN_INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.scanOnce();
    } catch (e) {
      this.logger.warn(`cc callback scan: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async scanOnce(now: Date = new Date()): Promise<void> {
    const due = await this.requests.findAll({
      where: {
        status: 'pending',
        next_attempt_at: { [Op.lte]: now },
      },
      limit: SCAN_BATCH,
    });

    for (const row of due) {
      if (Number(row.attempt_count) >= Number(row.max_attempts)) {
        await row.update({ status: 'failed', updated_at: now });
        continue;
      }
      if (!isWithinCallbackWindow(now, row.window_start, row.window_end)) {
        continue;
      }
      await this.attempt(row, now);
    }
  }

  private async attempt(row: CallbackRequest, now: Date): Promise<void> {
    const policy = await this.loadPolicy(row.user_uid);
    await row.update({ status: 'dialing', updated_at: now });
    try {
      await this.originate(row, policy.dial_order ?? 'agent_first');
      const attempts = Number(row.attempt_count ?? 0) + 1;
      await row.update({
        status: attempts >= row.max_attempts ? 'failed' : 'pending',
        attempt_count: attempts,
        next_attempt_at: new Date(now.getTime() + row.pause_minutes * 60_000),
        updated_at: now,
      });
    } catch (e) {
      const attempts = Number(row.attempt_count ?? 0) + 1;
      if (attempts >= row.max_attempts) {
        await row.update({
          status: 'failed',
          attempt_count: attempts,
          updated_at: now,
        });
        return;
      }
      const backoffMin = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
      await row.update({
        status: 'pending',
        attempt_count: attempts,
        next_attempt_at: new Date(now.getTime() + backoffMin * 60_000),
        updated_at: now,
      });
      this.logger.warn(`callback originate uid=${row.uid}: ${(e as Error).message}`);
    }
  }

  private async loadPolicy(userUid: number): Promise<ICallbackPolicy> {
    if (!this.settings) return { ...DEFAULT_CALLBACK_POLICY };
    const tenant = await this.settings.getTenantSettings(userUid);
    return sanitizeCallbackPolicy(
      (tenant?.callback_policy as Record<string, unknown> | null) ?? null,
      DEFAULT_CALLBACK_POLICY,
    );
  }

  private async originate(row: CallbackRequest, dialOrder: CallbackDialOrder): Promise<void> {
    if (!this.ami) return;
    await this.ami.action({
      action: 'Originate',
      channel: `Local/${row.caller}@krsk-click-to-call`,
      context: 'krsk-click-to-call',
      exten: row.caller,
      priority: '1',
      async: 'true',
      variable: `KRSK_CB_DIAL_ORDER=${dialOrder}`,
    });
  }
}
