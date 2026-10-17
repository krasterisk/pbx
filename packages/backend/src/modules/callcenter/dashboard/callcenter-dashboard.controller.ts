import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { assertSupervisor } from '../callcenter-rbac.util';
import { CallCenterDashboardService } from './callcenter-dashboard.service';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';

/** Call-center management dashboard (cc-analytics E2). Supervisor-gated; tenant from JWT only. */
@UseGuards(JwtAuthGuard)
@Controller('callcenter/dashboard')
export class CallCenterDashboardController {
  constructor(private readonly dashboard: CallCenterDashboardService) {}

  @Get('overview')
  getOverview(
    @Req() req: Request & { user: { level: number; vpbx_user_uid: number } },
    @Query() query: DashboardOverviewQueryDto,
  ) {
    assertSupervisor(req.user);
    return this.dashboard.getOverview(req.user.vpbx_user_uid, query);
  }
}
