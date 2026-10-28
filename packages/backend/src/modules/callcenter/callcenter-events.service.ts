/** Per-user, tenant-isolated stream shared by SSE and WebSocket transports. */
import { Injectable, MessageEvent, Logger } from '@nestjs/common';
import {
  Observable,
  map,
  merge,
  interval,
  startWith,
  filter,
  defer,
  from,
  switchMap,
  finalize,
} from 'rxjs';
import type { JwtPayloadUser } from '../auth/auth.service';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';
import { CallCenterAmiService } from './callcenter-ami.service';
import { CallCenterService } from './callcenter.service';

/** Heartbeat interval (ms) — keeps SSE connection alive through proxies/load balancers */
const SSE_HEARTBEAT_MS = 15_000;

@Injectable()
export class CallCenterEventsService {
  private readonly logger = new Logger(CallCenterEventsService.name);

  constructor(
    private readonly stateService: CallCenterStateService,
    private readonly metricsService: CallCenterMetricsService,
    private readonly amiCcService: CallCenterAmiService,
    private readonly ccService: CallCenterService,
  ) {}

  /**
   * SSE endpoint: GET /api/callcenter/events?token=<JWT>
   */
  events(user: JwtPayloadUser): Observable<MessageEvent> {
    const jwtUserUid = Number(user.vpbx_user_uid ?? 0);
    const userId = Number(user.sub);

    this.ccService.bumpPanelConnection(userId, 1);
    void this.ccService.touchPanelSeen(userId);

    // Rebind mid-call state before the snapshot so F5 / SSE reconnect keeps
    // caller ID, call controls, and the client card.
    return defer(() =>
      from(
        this.amiCcService.reconcileActiveAgentCalls().catch((err: any) => {
          this.logger.warn(
            `Event stream reconcile skipped: ${err?.message || err}`,
          );
        }),
      ).pipe(
        switchMap(() => {
          const { tenant: userUid, snapshot } =
            this.stateService.getSnapshotForUser(jwtUserUid, userId);
          this.logger.log(
            `Event stream opened: user ${userId}, jwtTenant=${jwtUserUid}, effectiveTenant=${userUid}`,
          );

          const monitor = this.stateService.getMonitorSession(userUid, userId);
          const snapshotWithKpi = {
            ...this.enrichSnapshotKpiDay(userUid, snapshot),
            monitorSession: monitor
              ? {
                  sessionId: monitor.id,
                  agentInterface: monitor.agentInterface,
                  agentName: monitor.agentName,
                  mode: monitor.mode,
                  startedAt: monitor.startedAt.toISOString(),
                  connected: monitor.connected ?? false,
                }
              : null,
          };

          const ccEvents$ = this.stateService
            .getEventStreamForUser(jwtUserUid, userId)
            .pipe(
              startWith({
                type: 'fullSnapshot',
                userUid,
                data: snapshotWithKpi,
              }),
              filter((event) => {
                if (
                  event.type !== 'ccChatMessage' &&
                  event.type !== 'monitorSession'
                )
                  return true;
                const recipients = event.data?.recipientUserIds;
                if (recipients === undefined) return true;
                if (!Array.isArray(recipients)) return true;
                return recipients.includes(userId);
              }),
              map((event) => {
                let data = event.data;
                if (
                  (event.type === 'ccChatMessage' ||
                    event.type === 'monitorSession') &&
                  data &&
                  typeof data === 'object'
                ) {
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
              // An empty `data` field is discarded by the browser and never reaches
              // the page, so an idle operator looked disconnected after 15s.
              data: '1',
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
  async getState(user: JwtPayloadUser) {
    await this.amiCcService.reconcileActiveAgentCalls().catch(() => undefined);
    const jwtUserUid = Number(user.vpbx_user_uid ?? 0);
    const { tenant, snapshot } = this.stateService.getSnapshotForUser(
      jwtUserUid,
      user.sub,
    );
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
