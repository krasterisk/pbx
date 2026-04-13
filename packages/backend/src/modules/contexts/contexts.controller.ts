import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ContextsService } from './contexts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('contexts')
export class ContextsController {
  constructor(private readonly contextsService: ContextsService) {}

  @Get()
  findAll(@Req() req: Request & { user: any }) {
    return this.contextsService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request & { user: any }) {
    return this.contextsService.findOne(+id, req.user.vpbx_user_uid);
  }

  @Post()
  create(@Body() body: any, @Req() req: Request & { user: any }) {
    return this.contextsService.create(body, req.user.vpbx_user_uid);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: Request & { user: any }) {
    return this.contextsService.update(+id, body, req.user.vpbx_user_uid);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request & { user: any }) {
    return this.contextsService.remove(+id, req.user.vpbx_user_uid);
  }
  @Post('bulk/delete')
  bulkDelete(@Body() body: { ids: number[] }, @Req() req: Request & { user: any }) {
    return this.contextsService.bulkRemove(body.ids, req.user.vpbx_user_uid);
  }
}
