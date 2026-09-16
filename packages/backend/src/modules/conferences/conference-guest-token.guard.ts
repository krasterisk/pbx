import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Request } from 'express';
import { conferenceRoomHttpError } from './conference-rooms.service';
import { ConferenceGuestToken } from './models/conference-guest-token.model';
import { ConferenceRoom } from './models/conference-room.model';

export type ConferenceGuestUser = {
  isGuest: true;
  roomUid: number;
  guestTokenUid: number;
  tokenKind: ConferenceGuestToken['kind'];
  inviteName: string | null;
  guestVpbxUserUid: number;
};

/**
 * Opaque guest-token gate for /conferences/guest/:token.
 * req.user is the six guest keys only — never sub/level (Pitfall 5).
 */
@Injectable()
export class ConferenceGuestTokenGuard implements CanActivate {
  constructor(
    @InjectModel(ConferenceGuestToken)
    private readonly tokenModel: typeof ConferenceGuestToken,
    @InjectModel(ConferenceRoom)
    private readonly roomModel: typeof ConferenceRoom,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: ConferenceGuestUser }>();
    const token = req.params?.token;

    if (!token || typeof token !== 'string') {
      throw conferenceRoomHttpError(
        HttpStatus.UNAUTHORIZED,
        'CONFERENCE_GUEST_TOKEN_INVALID',
        'Guest token invalid',
      );
    }

    const row = await this.tokenModel.findOne({ where: { token } });
    if (!row) {
      throw conferenceRoomHttpError(
        HttpStatus.UNAUTHORIZED,
        'CONFERENCE_GUEST_TOKEN_INVALID',
        'Guest token invalid',
      );
    }
    if (row.revoked_at != null) {
      throw conferenceRoomHttpError(
        HttpStatus.UNAUTHORIZED,
        'CONFERENCE_GUEST_TOKEN_REVOKED',
        'Guest token revoked',
      );
    }
    if (row.expires_at != null && row.expires_at < new Date()) {
      throw conferenceRoomHttpError(
        HttpStatus.UNAUTHORIZED,
        'CONFERENCE_GUEST_TOKEN_EXPIRED',
        'Guest token expired',
      );
    }

    const room = await this.roomModel.findOne({ where: { uid: row.room_uid } });
    if (!room) {
      throw conferenceRoomHttpError(
        HttpStatus.UNAUTHORIZED,
        'CONFERENCE_GUEST_TOKEN_INVALID',
        'Guest token invalid',
      );
    }

    req.user = {
      isGuest: true,
      roomUid: row.room_uid,
      guestTokenUid: row.uid,
      tokenKind: row.kind,
      inviteName: row.invite_name,
      guestVpbxUserUid: room.user_uid,
    };

    row.update({ last_used_at: new Date() }).catch(() => undefined);

    return true;
  }
}
