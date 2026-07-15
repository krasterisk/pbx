import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { CcQueueCall } from './models/queue-call.model';
import { CallCenterRollupService } from './callcenter-rollup.service';
import {
  QUEUE_LOG_READER,
  QueueLogEntry,
  QueueLogReader,
} from './queuelog/queue-log-reader.interface';

const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RECENT_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Backfill missing cc_queue_calls from Asterisk queue_log (D-05).
 * Triggers: AMI reconnect (reconcileRecent) + hourly safety-net cron.
 * After backfill of prior calendar days → recomputeDay (Pitfall 6 / T-07-04-04).
 */
@Injectable()
export class CallCenterQueueLogReconcilerService {
  private readonly logger = new Logger(CallCenterQueueLogReconcilerService.name);
  private running = false;

  constructor(
    @Inject(QUEUE_LOG_READER) private readonly reader: QueueLogReader,
    @InjectModel(CcQueueCall) private readonly queueCallModel: typeof CcQueueCall,
    private readonly rollupService: CallCenterRollupService,
  ) {}

  async reconcileRange(since: Date, until: Date): Promise<number> {
    if (this.running) {
      this.logger.warn('[reconciler] reconcileRange skipped — already running');
      return 0;
    }
    this.running = true;
    try {
      let from = since;
      let to = until;
      if (to.getTime() < from.getTime()) {
        [from, to] = [to, from];
      }
      // Resource bound (T-07-04-02): clamp window to ≤24h
      if (to.getTime() - from.getTime() > MAX_WINDOW_MS) {
        from = new Date(to.getTime() - MAX_WINDOW_MS);
        this.logger.warn('[reconciler] window clamped to 24h');
      }

      const entries = await this.reader.readEntries(from, to);
      const byCall = new Map<string, QueueLogEntry[]>();
      for (const e of entries) {
        if (!e.callId || e.callId === 'NONE') continue;
        const list = byCall.get(e.callId) || [];
        list.push(e);
        byCall.set(e.callId, list);
      }

      const toInsert: Partial<CcQueueCall>[] = [];
      const touchedDays = new Set<string>(); // `${dateOnly}|${userUid}`

      for (const [callId, callEntries] of byCall) {
        const existing = await this.queueCallModel.findOne({
          where: { call_uniqueid: callId },
        });
        if (existing) continue;

        const row = buildHistoryRow(callEntries);
        if (!row) continue;

        const userUid = resolveQueueTenant(row.queue_name);
        // T-07-04-03: skip unresolved tenant — never write user_uid=0
        if (userUid == null || userUid === 0) continue;

        row.user_uid = userUid;
        toInsert.push(row);

        const daySrc = row.end_time || row.enter_time || callEntries[0]?.timestamp;
        if (daySrc) {
          const day = startOfDay(daySrc);
          const today = startOfDay(new Date());
          if (day.getTime() < today.getTime()) {
            touchedDays.add(`${toDateOnly(day)}|${userUid}`);
          }
        }
      }

      if (toInsert.length) {
        await this.queueCallModel.bulkCreate(toInsert as any[], {
          ignoreDuplicates: true,
          validate: false,
        });
      }

      for (const key of touchedDays) {
        const [dateOnly, uidStr] = key.split('|');
        const day = new Date(`${dateOnly}T00:00:00`);
        await this.rollupService.recomputeDay(day, Number(uidStr));
      }

      this.logger.log(
        `[reconciler] source=${this.reader.source} inserted=${toInsert.length} scanned=${byCall.size}`,
      );
      return toInsert.length;
    } finally {
      this.running = false;
    }
  }

  /** AMI reconnect hook — backfill recent window (default 2h, env CC_QUEUE_LOG_RECENT_HOURS). */
  async reconcileRecent(): Promise<void> {
    const hours = Number(process.env.CC_QUEUE_LOG_RECENT_HOURS || 2);
    const windowMs = Number.isFinite(hours) && hours > 0
      ? hours * 60 * 60 * 1000
      : DEFAULT_RECENT_WINDOW_MS;
    const until = new Date();
    const since = new Date(until.getTime() - windowMs);
    await this.reconcileRange(since, until);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async hourlySafetyNet(): Promise<void> {
    try {
      await this.reconcileRecent();
    } catch (err) {
      this.logger.warn(`[reconciler] hourlySafetyNet failed: ${(err as Error).message}`);
    }
  }
}

/** Same convention as CallCenterAmiService.resolveQueueTenant: q{exten}_{vpbxUserUid}. */
export function resolveQueueTenant(queueName: string): number | null {
  const match = queueName.match(/_(\d+)$/);
  if (match) return parseInt(match[1], 10);
  return null;
}

function buildHistoryRow(entries: QueueLogEntry[]): Partial<CcQueueCall> | null {
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const queueName = sorted.find((e) => e.queueName)?.queueName || '';
  if (!queueName) return null;

  let enterTime: Date | undefined;
  let answerTime: Date | undefined;
  let endTime: Date | undefined;
  let agent = '';
  let waitTime = 0;
  let talkTime = 0;
  let disposition: CcQueueCall['disposition'] = 'other';
  let position = 0;
  let callerIdNum = '';

  for (const e of sorted) {
    const ev = e.event;
    if (ev === 'ENTERQUEUE') {
      enterTime = e.timestamp;
      position = parseInt(e.params[0] || '0', 10) || 0;
      callerIdNum = e.params[1] || '';
    } else if (ev === 'CONNECT') {
      answerTime = e.timestamp;
      agent = e.agent && e.agent !== 'NONE' ? e.agent : agent;
      waitTime = parseInt(e.params[0] || '0', 10) || waitTime;
    } else if (ev === 'COMPLETECALLER' || ev === 'COMPLETEAGENT') {
      endTime = e.timestamp;
      disposition = 'answered';
      waitTime = parseInt(e.params[0] || '0', 10) || waitTime;
      talkTime = parseInt(e.params[1] || '0', 10) || talkTime;
      agent = e.agent && e.agent !== 'NONE' ? e.agent : agent;
    } else if (ev === 'ABANDON') {
      endTime = e.timestamp;
      disposition = 'abandoned';
      position = parseInt(e.params[0] || String(position), 10) || position;
      waitTime = parseInt(e.params[2] || e.params[1] || '0', 10) || waitTime;
    } else if (ev === 'EXITWITHTIMEOUT') {
      endTime = e.timestamp;
      disposition = 'timeout';
    } else if (ev === 'TRANSFER') {
      endTime = e.timestamp;
      disposition = 'transferred';
      waitTime = parseInt(e.params[2] || '0', 10) || waitTime;
      talkTime = parseInt(e.params[3] || '0', 10) || talkTime;
      agent = e.agent && e.agent !== 'NONE' ? e.agent : agent;
    }
  }

  // Only persist terminal / meaningful outcomes
  if (disposition === 'other' && !answerTime && !endTime) return null;
  if (!endTime && answerTime) {
    endTime = sorted[sorted.length - 1].timestamp;
    disposition = disposition === 'other' ? 'answered' : disposition;
  }
  if (!endTime && disposition === 'other') return null;

  if (!enterTime) enterTime = sorted[0].timestamp;
  if (!waitTime && enterTime && answerTime) {
    waitTime = Math.max(0, Math.round((answerTime.getTime() - enterTime.getTime()) / 1000));
  }

  return {
    call_uniqueid: sorted[0].callId,
    queue_name: queueName,
    agent_interface: agent || '',
    caller_id_num: callerIdNum,
    enter_time: enterTime,
    answer_time: answerTime,
    end_time: endTime,
    wait_time: waitTime,
    talk_time: talkTime,
    hold_time: 0,
    wrapup_time: 0,
    disposition,
    position,
  };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
