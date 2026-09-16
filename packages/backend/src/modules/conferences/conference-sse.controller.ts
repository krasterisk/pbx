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
import { Observable, from, interval, map, merge, startWith, switchMap } from 'rxjs';
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
        const heartbeat$ = interval(SSE_HEARTBEAT_MS).pipe(
          map(() => ({
            data: '',
            type: 'heartbeat',
            id: undefined as unknown as string,
          })),
        );
        return merge(events$, heartbeat$);
      }),
    );
  }
}
