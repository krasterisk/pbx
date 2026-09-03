import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  CALLBACK_SOURCES,
  type CallbackSource,
  type CallbackStatus,
} from '@krasterisk/shared';
import { Op } from 'sequelize';
import { CcAgentQueue } from '../callcenter/models/agent-queue.model';
import { Route } from '../routes/route.model';
import { User } from '../users/user.model';
import { CallbackRequest } from './callback-request.model';
import type { CallbackListStatus } from './dto/callback-request.dto';

const WINDOW_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const CALLER_SAFE = /[^0-9+*#]/g;
const QUEUE_NAME_SAFE = /[^\w.\-]/g;
const DEDUPE_WINDOW_MS = 60_000;

const ACTIVE_STATUSES: CallbackStatus[] = ['pending', 'dialing'];
const COMPLETED_STATUSES: CallbackStatus[] = ['completed', 'failed', 'cancelled', 'expired'];

export interface CallbackEnqueueBody {
  caller?: string;
  clid?: string;
  vpbx_user_uid?: string | number;
  user_uid?: string | number;
  route_uid?: string | number;
  queue_uid?: string | number;
  queue_name?: string;
  step_id?: string;
  uniqueid?: string;
  source?: string;
  window_start?: string;
  window_end?: string;
  max_attempts?: string | number;
  pause_minutes?: string | number;
}

export interface CallbackRequestListItem {
  id: number;
  caller: string;
  queue_label: string | null;
  route_label: string | null;
  status: CallbackStatus;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: Date | null;
  window_start: string;
  window_end: string;
  claimed_agent: string | null;
  claimed_agent_uid: number | null;
  source: CallbackSource;
  created_at: Date;
}

export function parseTenantUid(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function sanitizeCaller(value: unknown): string {
  return String(value ?? '').replace(CALLER_SAFE, '').slice(0, 64);
}

export function sanitizeQueueName(value: unknown): string | null {
  const raw = String(value ?? '').replace(QUEUE_NAME_SAFE, '').slice(0, 64);
  return raw || null;
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

function statusesFor(listStatus: CallbackListStatus): CallbackStatus[] {
  return listStatus === 'completed' ? COMPLETED_STATUSES : ACTIVE_STATUSES;
}

@Injectable()
export class CallbackRequestsService {
  private readonly logger = new Logger(CallbackRequestsService.name);

  constructor(
    @InjectModel(CallbackRequest) private readonly requests: typeof CallbackRequest,
    @InjectModel(CcAgentQueue) private readonly agentQueues: typeof CcAgentQueue,
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Route) private readonly routes: typeof Route,
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
      queue_name: sanitizeQueueName(body.queue_name),
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

  async listForAgent(
    tenantUid: number,
    agentUid: number,
    listStatus: CallbackListStatus,
  ): Promise<CallbackRequestListItem[]> {
    const queueNames = await this.agentQueueNames(tenantUid, agentUid);
    const rows = await this.requests.findAll({
      where: {
        user_uid: tenantUid,
        status: { [Op.in]: statusesFor(listStatus) },
        queue_name: { [Op.in]: queueNames.length ? queueNames : [''] },
      },
      order: [['created_at', 'DESC']],
    });
    return this.toListItems(tenantUid, rows);
  }

  async listForSupervisor(
    tenantUid: number,
    listStatus: CallbackListStatus,
  ): Promise<CallbackRequestListItem[]> {
    const rows = await this.requests.findAll({
      where: {
        user_uid: tenantUid,
        status: { [Op.in]: statusesFor(listStatus) },
      },
      order: [['created_at', 'DESC']],
    });
    return this.toListItems(tenantUid, rows);
  }

  async claim(tenantUid: number, agentUid: number, id: number): Promise<{
    id: number;
    claimed_agent_uid: number;
  }> {
    const [updated] = await this.requests.update(
      { claimed_agent_uid: agentUid, updated_at: new Date() },
      {
        where: {
          uid: id,
          user_uid: tenantUid,
          claimed_agent_uid: null,
        },
      },
    );
    if (updated === 0) {
      const existing = await this.requests.findOne({
        where: { uid: id, user_uid: tenantUid },
      });
      if (!existing) throw new NotFoundException('Callback request not found');
      throw new ConflictException({ message: 'Callback request already claimed' });
    }
    return { id, claimed_agent_uid: agentUid };
  }

  async cancel(
    tenantUid: number,
    agentUid: number,
    id: number,
    isSupervisor: boolean,
  ): Promise<{ id: number; status: 'cancelled' }> {
    const existing = await this.requests.findOne({
      where: { uid: id, user_uid: tenantUid },
    });
    if (!existing) throw new NotFoundException('Callback request not found');

    if (!isSupervisor) {
      if (existing.status !== 'pending') {
        throw new ForbiddenException('Not allowed to cancel this request');
      }
      const names = await this.agentQueueNames(tenantUid, agentUid);
      if (!existing.queue_name || !names.includes(existing.queue_name)) {
        throw new ForbiddenException('Not allowed to cancel this request');
      }
    }

    await this.requests.update(
      { status: 'cancelled', updated_at: new Date() },
      { where: { uid: id, user_uid: tenantUid } },
    );
    return { id, status: 'cancelled' };
  }

  private async agentQueueNames(tenantUid: number, agentUid: number): Promise<string[]> {
    const rows = await this.agentQueues.findAll({
      where: { user_uid: tenantUid, user_id: agentUid },
      attributes: ['queue_name'],
    });
    return [...new Set(rows.map((r) => r.queue_name).filter(Boolean))];
  }

  private async toListItems(
    tenantUid: number,
    rows: CallbackRequest[],
  ): Promise<CallbackRequestListItem[]> {
    const claimedIds = [...new Set(
      rows.map((r) => r.claimed_agent_uid).filter((id): id is number => id != null && id > 0),
    )];
    const routeIds = [...new Set(
      rows.map((r) => r.route_uid).filter((id): id is number => id != null && id > 0),
    )];

    const [userRows, routeRows] = await Promise.all([
      claimedIds.length
        ? this.users.findAll({
            where: { uniqueid: { [Op.in]: claimedIds }, vpbx_user_uid: tenantUid },
            attributes: ['uniqueid', 'name'],
          })
        : Promise.resolve([]),
      routeIds.length
        ? this.routes.findAll({
            where: { uid: { [Op.in]: routeIds }, user_uid: tenantUid },
            attributes: ['uid', 'name'],
          })
        : Promise.resolve([]),
    ]);

    const namesById = new Map(userRows.map((u) => [u.uniqueid, u.name || null]));
    const routesById = new Map(routeRows.map((r) => [r.uid, r.name || null]));

    return rows.map((r) => ({
      id: r.uid,
      caller: r.caller,
      queue_label: r.queue_name || null,
      route_label: r.route_uid != null ? (routesById.get(r.route_uid) ?? null) : null,
      status: r.status,
      attempt_count: r.attempt_count,
      max_attempts: r.max_attempts,
      next_attempt_at: r.next_attempt_at,
      window_start: r.window_start,
      window_end: r.window_end,
      claimed_agent: r.claimed_agent_uid != null
        ? (namesById.get(r.claimed_agent_uid) ?? null)
        : null,
      claimed_agent_uid: r.claimed_agent_uid,
      source: r.source,
      created_at: r.created_at,
    }));
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
