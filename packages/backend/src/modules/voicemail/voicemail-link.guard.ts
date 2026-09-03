import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Request } from 'express';
import { VoicemailAccessToken } from './voicemail-access-token.model';

/**
 * VoicemailLinkGuard — validates opaque play tokens for GET /voicemail/play (D-59 / D-67).
 *
 * Separate auth branch from JwtAuthGuard: reads ?token= query param, looks up
 * vm_access_tokens, rejects missing/unknown/revoked/expired rows.
 *
 * Pitfall 5: req.user is set WITHOUT level/sub so a leaked play token cannot
 * silently escalate if it ever hits a JWT-guarded endpoint.
 */
@Injectable()
export class VoicemailLinkGuard implements CanActivate {
  constructor(
    @InjectModel(VoicemailAccessToken)
    private readonly tokenModel: typeof VoicemailAccessToken,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const token = req.query?.token;

    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Voicemail token required');
    }

    const row = await this.tokenModel.findOne({ where: { token } });
    if (!row) {
      throw new UnauthorizedException('Voicemail token invalid');
    }
    if (row.revoked_at != null) {
      throw new UnauthorizedException('Voicemail token revoked');
    }
    if (row.expires_at != null && row.expires_at < new Date()) {
      throw new UnauthorizedException('Voicemail token expired');
    }

    req.user = {
      vpbx_user_uid: row.vpbx_user_uid,
      isDisplayToken: true,
    };

    return true;
  }
}
