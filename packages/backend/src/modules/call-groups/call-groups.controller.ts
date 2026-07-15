import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { CallGroupsService } from './call-groups.service';
import {
  CreateCallGroupDto,
  UpdateCallGroupDto,
} from './dto/call-group.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('call-groups')
export class CallGroupsController {
  constructor(private readonly callGroupsService: CallGroupsService) {}

  @Get()
  findAll(@Req() req: Request & { user: any }) {
    return this.callGroupsService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':uid')
  findOne(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: any },
  ) {
    return this.callGroupsService.findOne(uid, req.user.vpbx_user_uid);
  }

  @Post()
  create(
    @Body() dto: CreateCallGroupDto,
    @Req() req: Request & { user: any },
  ) {
    return this.callGroupsService.create(dto, req.user.vpbx_user_uid);
  }

  @Put(':uid')
  update(
    @Param('uid', ParseIntPipe) uid: number,
    @Body() dto: UpdateCallGroupDto,
    @Req() req: Request & { user: any },
  ) {
    return this.callGroupsService.update(uid, dto, req.user.vpbx_user_uid);
  }

  @Delete(':uid')
  remove(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: any },
  ) {
    return this.callGroupsService.remove(uid, req.user.vpbx_user_uid);
  }
}
