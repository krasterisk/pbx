import { Controller, Get, Req, Sse, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayloadUser } from '../auth/auth.service';
import { CallCenterEventsService } from './callcenter-events.service';

/** Legacy SSE and snapshot HTTP contracts; both use the same authorized stream. */
@UseGuards(JwtAuthGuard)
@Controller('callcenter')
export class CallCenterSseController {
  constructor(private readonly eventsService: CallCenterEventsService) {}
  @Sse('events')
  events(@Req() req: Request & { user: JwtPayloadUser }) {
    return this.eventsService.events(req.user);
  }
  @Get('state')
  getState(@Req() req: Request & { user: JwtPayloadUser }) {
    return this.eventsService.getState(req.user);
  }
}
