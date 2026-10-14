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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { TrunksService, CreateTrunkDto, UpdateTrunkDto } from './trunks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserLevel } from '../users/user.model';

@UseGuards(JwtAuthGuard)
@Controller('trunks')
export class TrunksController {
  constructor(private readonly trunksService: TrunksService) {}

  @Get()
  findAll(@Req() req: Request & { user: any }) {
    return this.trunksService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':trunkId')
  findOne(@Param('trunkId') trunkId: string, @Req() req: Request & { user: any }) {
    return this.trunksService.findOne(trunkId, req.user.vpbx_user_uid);
  }

  @Post()
  create(@Body() dto: CreateTrunkDto, @Req() req: Request & { user: any }) {
    return this.trunksService.create(dto, req.user.vpbx_user_uid, req.user.uid);
  }

  @Put(':trunkId')
  update(
    @Param('trunkId') trunkId: string,
    @Body() dto: UpdateTrunkDto,
    @Req() req: Request & { user: any },
  ) {
    return this.trunksService.update(trunkId, dto, req.user.vpbx_user_uid, req.user.uid);
  }

  @Delete(':trunkId')
  remove(@Param('trunkId') trunkId: string, @Req() req: Request & { user: any }) {
    return this.trunksService.remove(trunkId, req.user.vpbx_user_uid, req.user.uid);
  }

  @Post('bulk/delete')
  bulkDelete(@Body() body: { ids: string[] }, @Req() req: Request & { user: any }) {
    return this.trunksService.bulkRemove(body.ids, req.user.vpbx_user_uid, req.user.uid);
  }

  @Post('bulk/register')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(RolesGuard)
  @Roles(UserLevel.ADMIN)
  bulkRegister(@Body() body: { ids: string[] }, @Req() req: Request & { user: any }) {
    return this.trunksService.bulkRegister(body?.ids, req.user.vpbx_user_uid, req.user.uid);
  }

  @Post(':trunkId/register')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(RolesGuard)
  @Roles(UserLevel.ADMIN)
  register(@Param('trunkId') trunkId: string, @Req() req: Request & { user: any }) {
    return this.trunksService.register(trunkId, req.user.vpbx_user_uid, req.user.uid);
  }
}
