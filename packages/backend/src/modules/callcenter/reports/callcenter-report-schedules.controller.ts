/**
 * Call Center report schedules REST API (D-35).
 * Supervisor-gated (D-38). Tenant from JWT only.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CallCenterReportSchedulesService } from './callcenter-report-schedules.service';
import { CallCenterReportDeliveryService } from './callcenter-report-delivery.service';
import {
  CreateReportScheduleDto,
  UpdateReportScheduleDto,
} from './dto/report-schedule.dto';
import { assertSupervisor } from '../callcenter-rbac.util';

@UseGuards(JwtAuthGuard)
@Controller('callcenter/report-schedules')
export class CallCenterReportSchedulesController {
  constructor(
    private readonly schedulesService: CallCenterReportSchedulesService,
    private readonly deliveryService: CallCenterReportDeliveryService,
  ) {}

  @Get()
  findAll(@Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.schedulesService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':uid')
  findOne(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.schedulesService.findOne(uid, req.user.vpbx_user_uid);
  }

  @Post()
  create(
    @Body() dto: CreateReportScheduleDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.schedulesService.create(dto, req.user.vpbx_user_uid);
  }

  @Put(':uid')
  update(
    @Param('uid', ParseIntPipe) uid: number,
    @Body() dto: UpdateReportScheduleDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.schedulesService.update(uid, dto, req.user.vpbx_user_uid);
  }

  @Delete(':uid')
  remove(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.schedulesService.remove(uid, req.user.vpbx_user_uid);
  }

  @Post(':uid/run-now')
  runNow(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.schedulesService.runNow(
      uid,
      req.user.vpbx_user_uid,
      this.deliveryService,
    );
  }
}
