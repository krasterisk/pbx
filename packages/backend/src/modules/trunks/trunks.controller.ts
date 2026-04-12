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
} from '@nestjs/common';
import { Request } from 'express';
import { TrunksService, CreateTrunkDto, UpdateTrunkDto } from './trunks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
}
