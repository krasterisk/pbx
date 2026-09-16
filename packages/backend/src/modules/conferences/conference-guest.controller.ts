import {
  Body,
  Controller,
  Get,
  Logger,
  MessageEvent,
  Post,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import {
  Observable,
  finalize,
  interval,
  map,
  merge,
  startWith,
  takeUntil,
} from 'rxjs';
import { ConferenceGuestService } from './conference-guest.service';
import {
  ConferenceGuestTokenGuard,
  type ConferenceGuestUser,
} from './conference-guest-token.guard';
import { ConferenceStateService } from './conference-state.service';
import { ConferenceDisplayNameDto } from './dto/conference-display-name.dto';
import { ConferenceGuestJoinDto } from './dto/conference-guest-join.dto';
import { toConferenceRoomStateDto } from './dto/conference-participant.dto';

const SSE_HEARTBEAT_MS = 15_000;

@Controller('conferences/guest')
export class ConferenceGuestController {
  private readonly logger = new Logger(ConferenceGuestController.name);

  constructor(
    private readonly guestService: ConferenceGuestService,
    private readonly stateService: ConferenceStateService,
  ) {}

  @UseGuards(ConferenceGuestTokenGuard)
  @Get(':token')
  getMeta(@Req() req: Request & { user: ConferenceGuestUser }) {
    return this.guestService.getMeta(req.user);
  }

  @UseGuards(ConferenceGuestTokenGuard)
  @Post(':token/join')
  join(
    @Req() req: Request & { user: ConferenceGuestUser },
    @Body() dto: ConferenceGuestJoinDto,
  ) {
    return this.guestService.join(req.user, dto);
  }

  @UseGuards(ConferenceGuestTokenGuard)
  @Post(':token/leave')
  leave(@Req() req: Request & { user: ConferenceGuestUser }) {
    return this.guestService.leave(req.user);
  }

  @UseGuards(ConferenceGuestTokenGuard)
  @Post(':token/me/display-name')
  setDisplayName(
    @Req() req: Request & { user: ConferenceGuestUser },
    @Body() dto: ConferenceDisplayNameDto,
  ) {
    return this.guestService.setDisplayName(req.user, dto);
  }

  @UseGuards(ConferenceGuestTokenGuard)
  @SkipThrottle({ default: true, global: true })
  @Post(':token/telemetry')
  ingestTelemetry(
    @Req() req: Request & { user: ConferenceGuestUser },
    @Body() body: Record<string, unknown>,
  ) {
    return this.guestService.ingestTelemetry(req.user, body ?? {});
  }

  @UseGuards(ConferenceGuestTokenGuard)
  @SkipThrottle({ default: true, global: true })
  @Sse(':token/events')
  events(@Req() req: Request & { user: ConferenceGuestUser }): Observable<MessageEvent> {
    const roomUid = req.user.roomUid;
    this.logger.log(`Conference guest SSE opened: room ${roomUid}`);
    const snapshot = this.stateService.getSnapshot(roomUid);
    const events$ = this.stateService.getEventStream(roomUid).pipe(
      startWith({
        type: 'fullSnapshot',
        roomUid,
        data: snapshot,
      }),
      map((event) => ({
        data: JSON.stringify(toConferenceRoomStateDto(event.data)),
        type: event.type,
        id: String(Date.now()),
      })),
    );
    const closed$ = new Observable<void>((subscriber) => {
      const target = req as unknown as { on?: Function; off?: Function; removeListener?: Function };
      if (typeof target.on !== 'function') return undefined;
      const onClose = () => {
        subscriber.next();
        subscriber.complete();
      };
      target.on('close', onClose);
      return () => {
        if (typeof target.off === 'function') target.off('close', onClose);
        else if (typeof target.removeListener === 'function') target.removeListener('close', onClose);
      };
    });
    const heartbeat$ = interval(SSE_HEARTBEAT_MS).pipe(
      takeUntil(closed$),
      map(() => ({
        data: '',
        type: 'heartbeat',
        id: undefined as unknown as string,
      })),
    );
    return merge(events$, heartbeat$).pipe(
      takeUntil(closed$),
      finalize(() => {
        this.logger.log(
          `Conference guest SSE closed: room ${roomUid} heartbeat stopped observers=${this.stateService.streamObserverCount(roomUid)}`,
        );
      }),
    );
  }
}
