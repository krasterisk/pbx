import { Controller, Get, Post, Delete, Body, Query, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ContextIncludesService } from './context-includes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('context-includes')
export class ContextIncludesController {
  constructor(private readonly ciService: ContextIncludesService) {}

  @Get()
  findByContext(
    @Query('contextUid') contextUid: string,
    @Req() req: Request & { user: any },
  ) {
    return this.ciService.findByContext(+contextUid, req.user.vpbx_user_uid);
  }

  @Post()
  add(
    @Body() body: { contextUid: number; includeUid: number },
    @Req() req: Request & { user: any },
  ) {
    return this.ciService.add(body.contextUid, body.includeUid, req.user.vpbx_user_uid);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: Request & { user: any },
  ) {
    return this.ciService.remove(+id, req.user.vpbx_user_uid);
  }
}
