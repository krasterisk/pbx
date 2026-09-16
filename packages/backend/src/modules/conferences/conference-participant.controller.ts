import {
  Body,
  Controller,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceStateService } from './conference-state.service';

class SetMyVideoDto {
  @IsBoolean()
  enabled!: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('conferences')
export class ConferenceParticipantController {
  constructor(
    private readonly roomsService: ConferenceRoomsService,
    private readonly stateService: ConferenceStateService,
  ) {}

  @Post(':room_uid/me/video')
  async setMyVideo(
    @Param('room_uid', ParseIntPipe) roomUid: number,
    @Body() dto: SetMyVideoDto,
    @Req() req: Request & { user: any },
  ) {
    await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
    const callerRef = await this.roomsService.resolveCallerRef(req.user);
    if (!callerRef) {
      throw new NotFoundException();
    }
    const self = this.stateService.findLiveParticipant(roomUid, callerRef);
    if (!self) {
      throw new NotFoundException();
    }
    this.stateService.setVideoState(roomUid, callerRef, Boolean(dto?.enabled));
  }
}
