import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
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

  @Post(':uid/recording/start')
  async start(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: { sub: number; vpbx_user_uid: number } },
    @Body() body?: unknown,
  ) {
    await this.roomsService.assertLiveRoomAccess(uid, req.user);
    return this.recordingService.startByModerator(uid, req.user, body);
  }

  @Post(':uid/recording/stop')
  async stop(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: { sub: number; vpbx_user_uid: number } },
  ) {
    await this.roomsService.assertLiveRoomAccess(uid, req.user);
    return this.recordingService.stopByModerator(uid, req.user);
  }

  @Get(':uid/meetings/:meetingUid/play')
  async play(
    @Param('uid', ParseIntPipe) uid: number,
    @Param('meetingUid', ParseIntPipe) meetingUid: number,
    @Req() req: Request & { user: { vpbx_user_uid: number; sub: number } },
    @Res() res: Response,
  ) {
    await this.roomsService.findOne(uid, req.user.vpbx_user_uid);
    return this.recordingService.streamMeeting(
      uid,
      meetingUid,
      req.user.vpbx_user_uid,
      req,
      res,
      req.user.sub,
    );
  }
}
