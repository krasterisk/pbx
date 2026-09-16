import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AmiService } from '../ami/ami.service';
import { LoggerService } from '../logger/logger.service';
import { normalizeTarget } from '../../shared/utils/dialplan-target.util';
import { resolveRoleForCaller, type ConferenceRole } from './conference-roles.util';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceStateService } from './conference-state.service';

type ModerationUser = { sub: number; vpbx_user_uid: number };

@Injectable()
export class ConferenceModerationService {
  constructor(
    private readonly roomsService: ConferenceRoomsService,
    private readonly stateService: ConferenceStateService,
    private readonly amiService: AmiService,
    private readonly loggerService: LoggerService,
  ) {}

  async muteParticipant(roomUid: number, participantRef: string, user: ModerationUser) {
    await this.assertCanModerate(roomUid, user, 'moderator');
    await this.runAmi(roomUid, participantRef, user, 'ConfbridgeMute');
  }

  async unmuteParticipant(roomUid: number, participantRef: string, user: ModerationUser) {
    await this.assertCanModerate(roomUid, user, 'moderator');
    await this.runAmi(roomUid, participantRef, user, 'ConfbridgeUnmute');
  }

  async kickParticipant(roomUid: number, participantRef: string, user: ModerationUser) {
    await this.assertCanModerate(roomUid, user, 'moderator');
    await this.runAmi(roomUid, participantRef, user, 'ConfbridgeKick');
    await this.loggerService.logAction(
      user.sub,
      'conference_kick',
      'conference_room',
      roomUid,
      user.vpbx_user_uid,
      `ref=${participantRef}`,
    );
  }

  async grantRole(
    roomUid: number,
    participantRef: string,
    role: Extract<ConferenceRole, 'moderator'>,
    user: ModerationUser,
  ) {
    await this.assertCanModerate(roomUid, user, 'owner');
    this.requireParticipant(roomUid, participantRef);
    this.stateService.grantRole(roomUid, participantRef, role);
    await this.loggerService.logAction(
      user.sub,
      'conference_grant_role',
      'conference_room',
      roomUid,
      user.vpbx_user_uid,
      `ref=${participantRef} role=${role}`,
    );
  }

  async revokeRole(roomUid: number, participantRef: string, user: ModerationUser) {
    await this.assertCanModerate(roomUid, user, 'owner');
    this.requireParticipant(roomUid, participantRef);
    this.stateService.revokeRole(roomUid, participantRef);
  }

  async assertCanModerate(
    roomUid: number,
    user: ModerationUser,
    required: 'moderator' | 'owner',
  ): Promise<void> {
    const callerRef = await this.roomsService.resolveCallerRef(user);
    if (!callerRef) {
      throw new ForbiddenException('Caller identity is not a room participant number');
    }
    const rows = await this.roomsService.getRoomModerators(roomUid, user.vpbx_user_uid);
    const ownerRef = rows.find((row) => row.role === 'owner')?.endpointRef ?? null;
    const moderatorRefs = rows
      .filter((row) => row.role === 'moderator')
      .map((row) => row.endpointRef);
    const role = resolveRoleForCaller(callerRef, {
      ownerRef,
      moderatorRefs,
      liveGrants: this.stateService.getLiveGrants(roomUid),
    });
    if (required === 'owner' && role !== 'owner') {
      throw new ForbiddenException('Owner role required');
    }
    if (required === 'moderator' && role !== 'owner' && role !== 'moderator') {
      throw new ForbiddenException('Moderator role required');
    }
  }

  private requireParticipant(roomUid: number, participantRef: string) {
    const participant = this.stateService.findLiveParticipant(roomUid, participantRef);
    if (!participant) {
      throw new NotFoundException(`Participant ${participantRef} is not in the room`);
    }
    return participant;
  }

  private async runAmi(
    roomUid: number,
    participantRef: string,
    user: ModerationUser,
    action: 'ConfbridgeMute' | 'ConfbridgeUnmute' | 'ConfbridgeKick',
  ): Promise<void> {
    const participant = this.requireParticipant(roomUid, participantRef);
    const room = await this.roomsService.findOne(roomUid, user.vpbx_user_uid);
    const conference = normalizeTarget(
      'conference',
      { source: 'fixed', value: String(room.number) },
      user.vpbx_user_uid,
    );
    await this.amiService.action({
      action,
      conference,
      channel: participant.channel,
    });
  }
}
