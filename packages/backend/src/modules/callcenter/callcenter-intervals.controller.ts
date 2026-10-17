import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { assertSupervisor } from './callcenter-rbac.util';
import { CallCenterIntervalService } from './callcenter-interval.service';
import { QueueIntervalsQueryDto } from './dto/queue-intervals-query.dto';

/**
 * Intraday series for the supervisor chart / interval reports (cc-analytics B4, C1).
 * Supervisor-gated; tenant from JWT only.
 */
@UseGuards(JwtAuthGuard)
@Controller('callcenter/intervals')
export class CallCenterIntervalsController {
  constructor(private readonly intervals: CallCenterIntervalService) {}

  @Get('queues')
  getQueueIntervals(
    @Req() req: Request & { user: { level: number; vpbx_user_uid: number } },
    @Query() query: QueueIntervalsQueryDto,
  ) {
    assertSupervisor(req.user);
    return this.intervals.getQueueIntervals(req.user.vpbx_user_uid, query);
  }

  /** Per-queue SLA of the last half hour vs the one before: the "trend" arrow on supervisor tiles. */
  @Get('queues/recent')
  getRecentQueueSla(@Req() req: Request & { user: { level: number; vpbx_user_uid: number } }) {
    assertSupervisor(req.user);
    return this.intervals.getRecentQueueSla(req.user.vpbx_user_uid);
  }
}
