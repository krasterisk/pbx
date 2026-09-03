import { Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { isSupervisorUser } from '../callcenter/callcenter-rbac.util';
import { CallbackRequestsService } from './callback-requests.service';
import { ListCallbackRequestsQueryDto } from './dto/callback-request.dto';

@UseGuards(JwtAuthGuard)
@Controller('callback-requests')
export class CallbackRequestsController {
  constructor(private readonly service: CallbackRequestsService) {}

  @Get()
  list(
    @Req() req: { user?: { vpbx_user_uid: number; sub: number; level?: number } },
    @Query() query: ListCallbackRequestsQueryDto,
  ) {
    const tenantUid = req.user!.vpbx_user_uid;
    const agentUid = req.user!.sub as number;
    const status = query.status === 'completed' ? 'completed' : 'active';
    if (isSupervisorUser(req.user)) {
      return this.service.listForSupervisor(tenantUid, status);
    }
    return this.service.listForAgent(tenantUid, agentUid, status);
  }

  @Post(':id/claim')
  claim(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { vpbx_user_uid: number; sub: number } },
  ) {
    return this.service.claim(req.user!.vpbx_user_uid, req.user!.sub as number, id);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { vpbx_user_uid: number; sub: number; level?: number } },
  ) {
    return this.service.cancel(
      req.user!.vpbx_user_uid,
      req.user!.sub as number,
      id,
      isSupervisorUser(req.user),
    );
  }
}
