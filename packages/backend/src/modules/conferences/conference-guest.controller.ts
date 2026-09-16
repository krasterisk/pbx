import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ConferenceGuestService } from './conference-guest.service';
import {
  ConferenceGuestTokenGuard,
  type ConferenceGuestUser,
} from './conference-guest-token.guard';
import { ConferenceGuestJoinDto } from './dto/conference-guest-join.dto';

@Controller('conferences/guest')
export class ConferenceGuestController {
  constructor(private readonly guestService: ConferenceGuestService) {}

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
}
