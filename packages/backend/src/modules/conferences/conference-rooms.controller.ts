import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConferenceRoomsService } from './conference-rooms.service';
import { CreateConferenceRoomDto } from './dto/create-conference-room.dto';

@UseGuards(JwtAuthGuard)
@Controller('conferences')
export class ConferenceRoomsController {
  constructor(private readonly conferenceRoomsService: ConferenceRoomsService) {}

  @Get()
  findAll(@Req() req: Request & { user: any }) {
    return this.conferenceRoomsService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':uid')
  findOne(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: any },
  ) {
    return this.conferenceRoomsService.findOne(uid, req.user.vpbx_user_uid);
  }

  @Post()
  create(
    @Body() dto: CreateConferenceRoomDto,
    @Req() req: Request & { user: any },
  ) {
    return this.conferenceRoomsService.create(
      dto,
      req.user.vpbx_user_uid,
      req.user.sub,
    );
  }
}
