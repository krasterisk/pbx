import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConferenceCapacityService } from './conference-capacity.service';
import { ConferenceInviteService } from './conference-invite.service';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceTelemetryService } from './conference-telemetry.service';
import { CreateConferenceGuestTokenDto } from './dto/conference-guest-token.dto';
import { ConferenceInviteDto } from './dto/conference-invite.dto';
import { CreateConferenceRoomDto } from './dto/create-conference-room.dto';
import { SetConferenceModeratorsDto } from './dto/conference-moderator.dto';
import { UpdateConferenceRoomDto } from './dto/update-conference-room.dto';

@UseGuards(JwtAuthGuard)
@Controller('conferences')
export class ConferenceRoomsController {
  constructor(
    private readonly conferenceRoomsService: ConferenceRoomsService,
    private readonly capacityService: ConferenceCapacityService,
    private readonly inviteService: ConferenceInviteService,
    private readonly telemetryService: ConferenceTelemetryService,
  ) {}

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

  @HttpCode(HttpStatus.ACCEPTED)
  @Post(':uid/invite')
  invite(
    @Param('uid', ParseIntPipe) uid: number,
    @Body() dto: ConferenceInviteDto,
    @Req() req: Request & { user: any },
  ) {
    return this.inviteService.invite(uid, req.user, dto);
  }

  @SkipThrottle({ default: true, global: true })
  @Post(':uid/telemetry')
  async ingestTelemetry(
    @Param('uid', ParseIntPipe) uid: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user: any },
  ) {
    await this.conferenceRoomsService.assertLiveRoomAccess(uid, req.user);
    const callerRef = await this.conferenceRoomsService.resolveCallerRef(req.user);
    if (!callerRef) {
      throw new ForbiddenException('Caller identity is not a room participant number');
    }
    return this.telemetryService.ingest(uid, callerRef, body ?? {});
  }

  @SkipThrottle({ default: true, global: true })
  @Get(':uid/capacity')
  async getCapacity(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: any },
  ) {
    const room = await this.conferenceRoomsService.findOne(uid, req.user.vpbx_user_uid);
    return { maxParticipants: this.capacityService.capacityForRoom(room) };
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
