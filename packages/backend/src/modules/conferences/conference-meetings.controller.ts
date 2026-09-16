import { Controller, Get, Param, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConferenceMeetingsService } from './conference-meetings.service';

@UseGuards(JwtAuthGuard)
@Controller('conferences')
export class ConferenceMeetingsController {
  constructor(private readonly meetingsService: ConferenceMeetingsService) {}

  @Get('recordings-by-uniqueid')
  recordingsByUniqueid(
    @Query('uniqueids') uniqueids: string,
    @Req() req: Request & { user: { vpbx_user_uid: number; sub: number } },
  ) {
    const ids = String(uniqueids ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return this.meetingsService.findRecordingsByUniqueids(
      req.user.vpbx_user_uid,
      ids,
      req.user.sub,
    );
  }

  @Get(':uid/meetings')
  list(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: { vpbx_user_uid: number } },
  ) {
    return this.meetingsService.listByRoom(uid, req.user.vpbx_user_uid);
  }
}
