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
import { Observable, map, merge, interval, startWith } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallCenterStateService } from './callcenter-state.service';

/** Heartbeat interval (ms) — keeps SSE connection alive through proxies/load balancers */
const SSE_HEARTBEAT_MS = 15_000;

@UseGuards(JwtAuthGuard)
@Controller('callcenter')
export class CallCenterSseController {
  private readonly logger = new Logger(CallCenterSseController.name);

  constructor(private readonly stateService: CallCenterStateService) {}

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
    const userUid = req.user.vpbx_user_uid;
    const userId = req.user.id;
    this.logger.log(`SSE connection opened: user ${userId}, tenant ${userUid}`);

    // Get initial snapshot
    const snapshot = this.stateService.getSnapshot(userUid);

    // Real CC events stream
    const ccEvents$ = this.stateService.getEventStream(userUid).pipe(
      // Send snapshot immediately on connect
      startWith({
        type: 'fullSnapshot',
        userUid,
        data: snapshot,
      }),
      // Map to SSE MessageEvent format
      map(event => ({
        data: JSON.stringify(event.data),
        type: event.type,
        id: String(event.data?._eventId || Date.now()),
      })),
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
    const userUid = req.user.vpbx_user_uid;
    return this.stateService.getSnapshot(userUid);
  }
}
