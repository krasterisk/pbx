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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConferenceRoomsService } from './conference-rooms.service';
import { CreateConferenceGuestTokenDto } from './dto/conference-guest-token.dto';
import { CreateConferenceRoomDto } from './dto/create-conference-room.dto';
import { SetConferenceModeratorsDto } from './dto/conference-moderator.dto';
import { UpdateConferenceRoomDto } from './dto/update-conference-room.dto';

@UseGuards(JwtAuthGuard)
@Controller('conferences')
export class ConferenceRoomsController {
  constructor(private readonly conferenceRoomsService: ConferenceRoomsService) {}

  @Get()
  findAll(@Req() req: Request & { user: any }) {
    return this.conferenceRoomsService.findAll(req.user.vpbx_user_uid);
  }

  @Post(':uid/guest-tokens')
  createGuestToken(
    @Param('uid', ParseIntPipe) uid: number,
    @Body() dto: CreateConferenceGuestTokenDto,
    @Req() req: Request & { user: any },
  ) {
    return this.conferenceRoomsService.createGuestToken(uid, dto, req.user.vpbx_user_uid);
  }

  @Get(':uid/guest-tokens')
  listGuestTokens(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: any },
  ) {
    return this.conferenceRoomsService.listGuestTokens(uid, req.user.vpbx_user_uid);
  }

  @Delete(':uid/guest-tokens/:tokenUid')
  revokeGuestToken(
    @Param('uid', ParseIntPipe) uid: number,
    @Param('tokenUid', ParseIntPipe) tokenUid: number,
    @Req() req: Request & { user: any },
  ) {
    return this.conferenceRoomsService.revokeGuestToken(uid, tokenUid, req.user.vpbx_user_uid);
  }

  @Get(':uid/moderators')
  getModerators(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: any },
  ) {
    return this.conferenceRoomsService.getRoomModerators(uid, req.user.vpbx_user_uid);
  }

  @Put(':uid/moderators')
  setModerators(
    @Param('uid', ParseIntPipe) uid: number,
    @Body() dto: SetConferenceModeratorsDto,
    @Req() req: Request & { user: any },
  ) {
    return this.conferenceRoomsService.setRoomModerators(
      uid,
      dto,
      req.user.vpbx_user_uid,
    );
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

  @Put(':uid')
  update(
    @Param('uid', ParseIntPipe) uid: number,
    @Body() dto: UpdateConferenceRoomDto,
    @Req() req: Request & { user: any },
  ) {
    return this.conferenceRoomsService.update(uid, dto, req.user.vpbx_user_uid);
  }

  @Delete(':uid')
  remove(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: any },
  ) {
    return this.conferenceRoomsService.remove(uid, req.user.vpbx_user_uid);
  }
}
