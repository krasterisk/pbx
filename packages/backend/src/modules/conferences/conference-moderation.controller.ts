import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConferenceModerationService } from './conference-moderation.service';
import { ConferenceRoomsService } from './conference-rooms.service';

class GrantConferenceRoleDto {
  @IsOptional()
  @IsIn(['moderator'])
  role?: 'moderator';
}

@UseGuards(JwtAuthGuard)
@Controller('conferences')
export class ConferenceModerationController {
  constructor(
    private readonly roomsService: ConferenceRoomsService,
    private readonly moderationService: ConferenceModerationService,
  ) {}

  @Post(':room_uid/participants/:ref/mute')
  async mute(
    @Param('room_uid', ParseIntPipe) roomUid: number,
    @Param('ref') ref: string,
    @Req() req: Request & { user: any },
  ) {
    await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
    return this.moderationService.muteParticipant(roomUid, ref, req.user);
  }

  @Post(':room_uid/participants/:ref/unmute')
  async unmute(
    @Param('room_uid', ParseIntPipe) roomUid: number,
    @Param('ref') ref: string,
    @Req() req: Request & { user: any },
  ) {
    await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
    return this.moderationService.unmuteParticipant(roomUid, ref, req.user);
  }

  @Post(':room_uid/participants/:ref/kick')
  async kick(
    @Param('room_uid', ParseIntPipe) roomUid: number,
    @Param('ref') ref: string,
    @Req() req: Request & { user: any },
  ) {
    await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
    return this.moderationService.kickParticipant(roomUid, ref, req.user);
  }

  @Post(':room_uid/participants/:ref/role')
  async grantRole(
    @Param('room_uid', ParseIntPipe) roomUid: number,
    @Param('ref') ref: string,
    @Body() dto: GrantConferenceRoleDto,
    @Req() req: Request & { user: any },
  ) {
    await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
    return this.moderationService.grantRole(roomUid, ref, dto?.role ?? 'moderator', req.user);
  }

  @Delete(':room_uid/participants/:ref/role')
  async revokeRole(
    @Param('room_uid', ParseIntPipe) roomUid: number,
    @Param('ref') ref: string,
    @Req() req: Request & { user: any },
  ) {
    await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
    return this.moderationService.revokeRole(roomUid, ref, req.user);
  }
}
