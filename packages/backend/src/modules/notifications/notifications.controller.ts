import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import {
  CreateNotificationIntegrationDto,
  UpdateNotificationIntegrationDto,
} from './dto/notification-integration.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Req() req: { user: { vpbx_user_uid: number } }) {
    return this.notificationsService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':uid')
  findOne(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: { user: { vpbx_user_uid: number } },
  ) {
    return this.notificationsService.findOne(uid, req.user.vpbx_user_uid);
  }

  @Post()
  create(
    @Body() dto: CreateNotificationIntegrationDto,
    @Req() req: { user: { vpbx_user_uid: number } },
  ) {
    return this.notificationsService.create(dto, req.user.vpbx_user_uid);
  }

  @Put(':uid')
  update(
    @Param('uid', ParseIntPipe) uid: number,
    @Body() dto: UpdateNotificationIntegrationDto,
    @Req() req: { user: { vpbx_user_uid: number } },
  ) {
    return this.notificationsService.update(uid, dto, req.user.vpbx_user_uid);
  }

  @Delete(':uid')
  remove(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: { user: { vpbx_user_uid: number } },
  ) {
    return this.notificationsService.remove(uid, req.user.vpbx_user_uid);
  }
}
