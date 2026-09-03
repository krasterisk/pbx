import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  CALLBACK_SOURCES,
  type CallbackSource,
} from '@krasterisk/shared';
import { Op } from 'sequelize';
import { CallbackRequest } from './callback-request.model';

const WINDOW_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const CALLER_SAFE = /[^0-9+*#]/g;
const DEDUPE_WINDOW_MS = 60_000;

export interface CallbackEnqueueBody {
  caller?: string;
  clid?: string;
  vpbx_user_uid?: string | number;
  user_uid?: string | number;
  route_uid?: string | number;
  queue_uid?: string | number;
  step_id?: string;
  uniqueid?: string;
  source?: string;
  window_start?: string;
  window_end?: string;
  max_attempts?: string | number;
  pause_minutes?: string | number;
}

export function parseTenantUid(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function sanitizeCaller(value: unknown): string {
  return String(value ?? '').replace(CALLER_SAFE, '').slice(0, 64);
}

export function sanitizeWindow(value: unknown, fallback: string): string {
  const raw = String(value ?? '').trim();
  return WINDOW_HH_MM.test(raw) ? raw : fallback;
}

export function parsePositiveInt(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.trunc(n), max);
}

export function parseCallbackSource(value: unknown): CallbackSource {
  const raw = String(value ?? '');
  return (CALLBACK_SOURCES as readonly string[]).includes(raw)
    ? (raw as CallbackSource)
    : 'route_step';
}

@Injectable()
export class CallbackRequestsService {
  private readonly logger = new Logger(CallbackRequestsService.name);

  constructor(
    @InjectModel(CallbackRequest) private readonly requests: typeof CallbackRequest,
  ) {}

  /**
   * Persist a pending callback request from dialplan CURL or queue hooks.
   * Dedupes rapid double-fire (same tenant + caller + uniqueid within 60s).
   */
  async enqueue(body: CallbackEnqueueBody): Promise<CallbackRequest | null> {
    const userUid = parseTenantUid(body.vpbx_user_uid ?? body.user_uid);
    if (userUid == null) {
      this.logger.warn('callback enqueue rejected: invalid tenant uid');
      return null;
    }

    const caller = sanitizeCaller(body.caller ?? body.clid);
    if (!caller) {
      this.logger.warn('callback enqueue rejected: empty caller');
      return null;
    }

    const uniqueid = String(body.uniqueid ?? '').replace(/[^\w.\-]/g, '').slice(0, 128) || null;
    const source = parseCallbackSource(body.source);
    const existing = await this.findRecentDuplicate(userUid, caller, uniqueid, source);
    if (existing) return existing;

    const now = new Date();
    return this.requests.create({
      user_uid: userUid,
      caller,
      route_uid: parseTenantUid(body.route_uid),
      queue_uid: parseTenantUid(body.queue_uid),
      step_id: String(body.step_id ?? '').slice(0, 64) || null,
      uniqueid,
      status: 'pending',
      attempt_count: 0,
      max_attempts: parsePositiveInt(body.max_attempts, 3, 20),
      pause_minutes: parsePositiveInt(body.pause_minutes, 30, 1440),
      next_attempt_at: now,
      window_start: sanitizeWindow(body.window_start, '09:00'),
      window_end: sanitizeWindow(body.window_end, '21:00'),
      claimed_agent_uid: null,
      source,
      created_at: now,
      updated_at: now,
    });
  }

  private async findRecentDuplicate(
    userUid: number,
    caller: string,
    uniqueid: string | null,
    source: CallbackSource,
  ): Promise<CallbackRequest | null> {
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const where: Record<string, unknown> = {
      user_uid: userUid,
      caller,
      source,
      status: 'pending',
      created_at: { [Op.gte]: since },
    };
    if (uniqueid) where.uniqueid = uniqueid;
    return this.requests.findOne({ where, order: [['uid', 'DESC']] });
  }
}
