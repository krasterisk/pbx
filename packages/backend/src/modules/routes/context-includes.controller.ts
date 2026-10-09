import { Controller, Get, Post, Delete, Body, Query, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ContextIncludesService } from './context-includes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RouteApplyService } from './route-apply.service';

@UseGuards(JwtAuthGuard)
@Controller('context-includes')
export class ContextIncludesController {
  constructor(private readonly ciService: ContextIncludesService, private readonly applyService: RouteApplyService) {}

  private async apply(uid: number, user: any) {
    try { return (await this.applyService.applyContext(uid, user.vpbx_user_uid, user.level === 1)).success; }
    catch { return false; }
  }

  @Get()
  findByContext(
    @Query('contextUid') contextUid: string,
    @Req() req: Request & { user: any },
  ) {
    return this.ciService.findByContext(+contextUid, req.user.vpbx_user_uid);
  }

  @Post()
  async add(
    @Body() body: { contextUid: number; includeUid: number },
    @Req() req: Request & { user: any },
  ) {
    const row = await this.ciService.add(body.contextUid, body.includeUid, req.user.vpbx_user_uid);
    return { ...row.toJSON(), dialplan_applied: await this.apply(body.contextUid, req.user) };
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: Request & { user: any },
  ) {
    const contextUid = await this.ciService.remove(+id, req.user.vpbx_user_uid);
    return { success: true, dialplan_applied: await this.apply(contextUid, req.user) };
  }
}
