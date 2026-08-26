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
 * - Tracks panel presence (active SSE count) for shift idle policy
 */
import { Controller, Sse, Req, UseGuards, Get, MessageEvent, Logger } from '@nestjs/common';
import { Request } from 'express';
import {
  Observable, map, merge, interval, startWith, filter, defer, from, switchMap, finalize,
} from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';
import { CallCenterAmiService } from './callcenter-ami.service';
import { CallCenterService } from './callcenter.service';

/** Heartbeat interval (ms) — keeps SSE connection alive through proxies/load balancers */
const SSE_HEARTBEAT_MS = 15_000;

@UseGuards(JwtAuthGuard)
@Controller('callcenter')
export class CallCenterSseController {
  private readonly logger = new Logger(CallCenterSseController.name);

  constructor(
    private readonly stateService: CallCenterStateService,
    private readonly metricsService: CallCenterMetricsService,
    private readonly amiCcService: CallCenterAmiService,
    private readonly ccService: CallCenterService,
  ) {}

  /**
   * SSE endpoint: GET /api/callcenter/events?token=<JWT>
   */
  @Sse('events')
  events(@Req() req: Request & { user: any }): Observable<MessageEvent> {
    const jwtUserUid = Number(req.user.vpbx_user_uid ?? 0);
    const userId = Number(req.user.sub);

    this.ccService.bumpPanelConnection(userId, 1);
    void this.ccService.touchPanelSeen(userId);

    // Rebind mid-call state before the snapshot so F5 / SSE reconnect keeps
    // caller ID, call controls, and the client card.
    return defer(() =>
      from(
        this.amiCcService.reconcileActiveAgentCalls().catch((err: any) => {
          this.logger.warn(`SSE reconcile skipped: ${err?.message || err}`);
        }),
      ).pipe(
        switchMap(() => {
          const { tenant: userUid, snapshot } = this.stateService.getSnapshotForUser(jwtUserUid, userId);
          this.logger.log(
            `SSE connection opened: user ${userId}, jwtTenant=${jwtUserUid}, effectiveTenant=${userUid}`,
          );

          const snapshotWithKpi = this.enrichSnapshotKpiDay(userUid, snapshot);

          const ccEvents$ = this.stateService.getEventStreamForUser(jwtUserUid, userId).pipe(
            startWith({
              type: 'fullSnapshot',
              userUid,
              data: snapshotWithKpi,
            }),
            filter((event) => {
              if (event.type !== 'ccChatMessage') return true;
              const recipients = event.data?.recipientUserIds;
              if (recipients === undefined) return true;
              if (!Array.isArray(recipients)) return true;
              return recipients.includes(userId);
            }),
            map((event) => {
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

          const heartbeat$ = interval(SSE_HEARTBEAT_MS).pipe(
            map(() => ({
              data: '',
              type: 'heartbeat',
              id: undefined as any,
            })),
          );

          return merge(ccEvents$, heartbeat$);
        }),
        finalize(() => {
          const left = this.ccService.bumpPanelConnection(userId, -1);
          if (left <= 0) {
            void this.ccService.touchPanelSeen(userId);
          }
        }),
      ),
    );
  }

  /**
   * REST endpoint: GET /api/callcenter/state
   */
  @Get('state')
  async getState(@Req() req: Request & { user: any }) {
    await this.amiCcService.reconcileActiveAgentCalls().catch(() => undefined);
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
