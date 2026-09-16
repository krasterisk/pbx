import { Controller, Get, Param, ParseIntPipe, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConferenceRecordingService } from './conference-recording.service';
import { ConferenceRoomsService } from './conference-rooms.service';

@UseGuards(JwtAuthGuard)
@Controller('conferences')
export class ConferenceRecordingController {
  constructor(
    private readonly roomsService: ConferenceRoomsService,
    private readonly recordingService: ConferenceRecordingService,
  ) {}

  @Get(':uid/meetings/:meetingUid/play')
  async play(
    @Param('uid', ParseIntPipe) uid: number,
    @Param('meetingUid', ParseIntPipe) meetingUid: number,
    @Req() req: Request & { user: { vpbx_user_uid: number } },
    @Res() res: Response,
  ) {
    await this.roomsService.findOne(uid, req.user.vpbx_user_uid);
    return this.recordingService.streamMeeting(
      uid,
      meetingUid,
      req.user.vpbx_user_uid,
      req,
      res,
    );
  }
}
