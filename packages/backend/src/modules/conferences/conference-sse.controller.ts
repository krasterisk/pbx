import {
  Controller,
  Logger,
  MessageEvent,
  Param,
  ParseIntPipe,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  Observable,
  finalize,
  from,
  interval,
  map,
  merge,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceStateService } from './conference-state.service';
import { toConferenceRoomStateDto } from './dto/conference-participant.dto';

const SSE_HEARTBEAT_MS = 15_000;

@Controller('conferences')
export class ConferenceSseController {
  private readonly logger = new Logger(ConferenceSseController.name);

  constructor(
    private readonly roomsService: ConferenceRoomsService,
    private readonly stateService: ConferenceStateService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Sse(':room_uid/events')
  events(
    @Req() req: Request & { user: any },
    @Param('room_uid', ParseIntPipe) roomUid: number,
  ): Observable<MessageEvent> {
    return from(this.roomsService.assertLiveRoomAccess(roomUid, req.user)).pipe(
      switchMap(() => {
        this.logger.log(
          `Conference SSE opened: room ${roomUid} tenant ${req.user.vpbx_user_uid}`,
        );
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
          const target = req as unknown as {
            on?: (event: 'close', listener: () => void) => void;
            off?: (event: 'close', listener: () => void) => void;
            removeListener?: (event: 'close', listener: () => void) => void;
          };
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
              `Conference SSE closed: room ${roomUid} heartbeat stopped observers=${this.stateService.streamObserverCount(roomUid)}`,
            );
          }),
        );
      }),
    );
  }
}
