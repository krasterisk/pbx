import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProvisionTemplatesService } from './provision-templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('provision-templates')
@UseGuards(JwtAuthGuard)
export class ProvisionTemplatesController {
  constructor(private readonly templatesService: ProvisionTemplatesService) {}

  @Get()
  findAll(@Req() req: Request & { user: any }) {
    return this.templatesService.findAll(req.user.vpbx_user_uid);
  }

  @Post()
  create(@Body() data: any, @Req() req: Request & { user: any }) {
    return this.templatesService.create(data, req.user.vpbx_user_uid);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any, @Req() req: Request & { user: any }) {
    return this.templatesService.update(parseInt(id, 10), data, req.user.vpbx_user_uid);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request & { user: any }) {
    return this.templatesService.remove(parseInt(id, 10), req.user.vpbx_user_uid);
  }
}
