import {
  Controller,
  Logger,
  MessageEvent,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, finalize, interval, map, merge, startWith, from, exhaustMap, catchError, of } from 'rxjs';
import { AutodialMonitorService } from './autodial-monitor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { AutodialStateService } from './autodial-state.service';

const SSE_HEARTBEAT_MS = 15_000;

@Controller('autodial')
export class AutodialSseController {
  private readonly logger = new Logger(AutodialSseController.name);

  constructor(private readonly state: AutodialStateService, private readonly monitor: AutodialMonitorService) {}

  @UseGuards(JwtAuthGuard, ModuleAccessGuard)
  @RequiresModule('autodial')
  @Sse('events')
  events(@Req() req: Request & { user: { vpbx_user_uid: number } }): Observable<MessageEvent> {
    const userUid = req.user.vpbx_user_uid;
    this.logger.log(`Autodial SSE opened for tenant ${userUid}`);

    const events$ = this.state.stream(userUid).pipe(
      startWith(this.state.snapshot(userUid)),
      map((event) => ({ data: JSON.stringify(event), type: event.type })),
    );

    // Heartbeat keeps proxies from closing an idle campaign stream.
    const heartbeat$ = interval(SSE_HEARTBEAT_MS).pipe(
      map(() => ({ data: JSON.stringify({ type: 'heartbeat', ts: Date.now() }), type: 'heartbeat' })),
    );

    const health$ = interval(10000).pipe(startWith(0), exhaustMap(() => from(this.monitor.health(userUid)).pipe(
      map((health) => ({ type: 'health', data: JSON.stringify({ type: 'health', health }) })),
      catchError(() => of({ type: 'health_error', data: JSON.stringify({ type: 'health_error' }) })),
    )));
    return merge(events$, heartbeat$, health$).pipe(
      finalize(() => this.logger.log(`Autodial SSE closed for tenant ${userUid}`)),
    );
  }
}
