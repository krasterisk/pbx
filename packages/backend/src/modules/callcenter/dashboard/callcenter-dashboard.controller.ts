import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { assertSupervisor } from '../callcenter-rbac.util';
import { CallCenterAccessListService } from '../callcenter-access-list.service';
import { UserLevel } from '../../users/user.model';
import { CallCenterDashboardService } from './callcenter-dashboard.service';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';

/** Call-center management dashboard (cc-analytics E2). Supervisor-gated; tenant from JWT only. */
@UseGuards(JwtAuthGuard)
@Controller('callcenter/dashboard')
export class CallCenterDashboardController {
  constructor(
    private readonly dashboard: CallCenterDashboardService,
    private readonly accessList: CallCenterAccessListService,
  ) {}

  @Get('overview')
  async getOverview(
    @Req() req: Request & { user: { level: number; sub: number; vpbx_user_uid: number } },
    @Query() query: DashboardOverviewQueryDto,
  ) {
    assertSupervisor(req.user);
    const unrestricted = req.user.level === UserLevel.SUPERADMIN || req.user.level === UserLevel.ADMIN;
    const scope = unrestricted ? null : await this.accessList.resolveScope(req.user.vpbx_user_uid, req.user.sub);
    return this.dashboard.getOverview(req.user.vpbx_user_uid, query, scope ? {
      operatorUserIds: scope.operators ? [...scope.operators] : null,
      queues: scope.queues ? [...scope.queues] : null,
    } : undefined);
  }
}
