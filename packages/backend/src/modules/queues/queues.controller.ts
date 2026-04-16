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
import { QueuesService, CreateQueueDto, UpdateQueueDto } from './queues.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('queues')
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Get()
  findAll(@Req() req: Request & { user: any }) {
    return this.queuesService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':name')
  findOne(@Param('name') name: string, @Req() req: Request & { user: any }) {
    return this.queuesService.findOne(name, req.user.vpbx_user_uid);
  }

  @Post()
  create(@Body() dto: CreateQueueDto, @Req() req: Request & { user: any }) {
    return this.queuesService.create(dto, req.user.vpbx_user_uid);
  }

  @Put(':name')
  update(
    @Param('name') name: string,
    @Body() dto: UpdateQueueDto,
    @Req() req: Request & { user: any },
  ) {
    return this.queuesService.update(name, dto, req.user.vpbx_user_uid);
  }

  @Delete(':name')
  remove(@Param('name') name: string, @Req() req: Request & { user: any }) {
    return this.queuesService.remove(name, req.user.vpbx_user_uid);
  }
}
