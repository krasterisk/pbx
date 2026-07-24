/**
 * CallCenter SSE Controller.
 *
 * Provides Server-Sent Events endpoint for real-time push to browsers.
 * Zero dependencies on frontend — uses native EventSource API.
 * Tenant-isolated: each connection only receives events for its vpbx_user_uid.
 *
 * Features:
 * - JWT auth via ?token= query param (EventSource can't set headers)
 * - Heartbeat every 15s to prevent proxy/LB timeout
 * - fullSnapshot on initial connect
 * - Auto-reconnect is built into browser EventSource API
 */
import { Controller, Sse, Req, UseGuards, Get, MessageEvent, Logger } from '@nestjs/common';
import { Request } from 'express';
import { Observable, map, merge, interval, startWith, filter } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';

/** Heartbeat interval (ms) — keeps SSE connection alive through proxies/load balancers */
const SSE_HEARTBEAT_MS = 15_000;

@UseGuards(JwtAuthGuard)
@Controller('callcenter')
export class CallCenterSseController {
  private readonly logger = new Logger(CallCenterSseController.name);

  constructor(
    private readonly stateService: CallCenterStateService,
    private readonly metricsService: CallCenterMetricsService,
  ) {}

  /**
   * SSE endpoint: GET /api/callcenter/events?token=<JWT>
   *
   * On connect: sends a fullSnapshot event with current state.
   * Then streams all CC events filtered by tenant in real-time.
   * Heartbeat comment is sent every 15s to keep connection alive.
   *
   * Browser usage:
   *   const es = new EventSource('/api/callcenter/events?token=' + accessToken);
   *   es.addEventListener('agentUpdate', (e) => { ... });
   *   es.addEventListener('fullSnapshot', (e) => { ... });
   */
  @Sse('events')
  events(@Req() req: Request & { user: any }): Observable<MessageEvent> {
    const jwtUserUid = Number(req.user.vpbx_user_uid ?? 0);
    const userId = req.user.sub;
    const { tenant: userUid, snapshot } = this.stateService.getSnapshotForUser(jwtUserUid, userId);
    this.logger.log(
      `SSE connection opened: user ${userId}, jwtTenant=${jwtUserUid}, effectiveTenant=${userUid}`,
    );

    const snapshotWithKpi = this.enrichSnapshotKpiDay(userUid, snapshot);

    // Real CC events stream (JWT tenant and/or queue-suffix tenant where agent is online)
    const ccEvents$ = this.stateService.getEventStreamForUser(jwtUserUid, userId).pipe(
      // Send snapshot immediately on connect
      startWith({
        type: 'fullSnapshot',
        userUid,
        data: snapshotWithKpi,
      }),
      // Drop chat messages not addressed to this user (server-side recipient filter)
      filter(event => {
        if (event.type !== 'ccChatMessage') return true;
        const recipients = event.data?.recipientUserIds;
        if (recipients === undefined) return true;
        if (!Array.isArray(recipients)) return true;
        return recipients.includes(userId);
      }),
      // Map to SSE MessageEvent format
      map(event => {
        let data = event.data;
        if (event.type === 'ccChatMessage' && data && typeof data === 'object') {
          const { recipientUserIds: _omit, ...rest } = data;
          data = rest;
        }
        return {
          data: JSON.stringify(data),
          type: event.type,
          id: String(data?._eventId || Date.now()),
        };
      }),
    );

    // Heartbeat stream — SSE comment to keep connection alive through proxies
    // NestJS SSE sends { data: '' } as a comment-like keepalive
    const heartbeat$ = interval(SSE_HEARTBEAT_MS).pipe(
      map(() => ({
        data: '',
        type: 'heartbeat',
        id: undefined as any,
      })),
    );

    return merge(ccEvents$, heartbeat$);
  }

  /**
   * REST endpoint: GET /api/callcenter/state
   *
   * Returns the current snapshot (for initial page load or manual refresh).
   * Useful when SSE is not yet connected or for debugging.
   */
  @Get('state')
  getState(@Req() req: Request & { user: any }) {
    const jwtUserUid = Number(req.user.vpbx_user_uid ?? 0);
    const { tenant, snapshot } = this.stateService.getSnapshotForUser(jwtUserUid, req.user.sub);
    return this.enrichSnapshotKpiDay(tenant, snapshot);
  }

  /** Attach since-midnight KPI so panel day/both modes work for all coworkers. */
  private enrichSnapshotKpiDay(
    userUid: number,
    snapshot: { agents: any[]; queues: any[]; calls: any[] },
  ) {
    return {
      ...snapshot,
      agents: snapshot.agents.map((agent) => {
        const kpi = this.metricsService.getAgentKpi(userUid, agent.interface);
        return {
          ...agent,
          kpiDay: {
            answered: kpi.sinceMidnight.answered,
            made: kpi.sinceMidnight.made,
            missed: kpi.sinceMidnight.missed,
          },
        };
      }),
    };
  }
}
