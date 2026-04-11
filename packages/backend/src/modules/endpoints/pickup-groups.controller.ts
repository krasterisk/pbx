import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { PickupGroupsService } from './pickup-groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('pickup-groups')
@UseGuards(JwtAuthGuard)
export class PickupGroupsController {
  constructor(private readonly pickupGroupsService: PickupGroupsService) {}

  @Get()
  findAll(@Req() req: Request & { user: any }) {
    return this.pickupGroupsService.findAll(req.user.vpbx_user_uid);
  }

  @Post()
  create(@Body('name') name: string, @Req() req: Request & { user: any }) {
    return this.pickupGroupsService.create(name, req.user.vpbx_user_uid);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request & { user: any }) {
    return this.pickupGroupsService.remove(parseInt(id, 10), req.user.vpbx_user_uid);
  }
}
