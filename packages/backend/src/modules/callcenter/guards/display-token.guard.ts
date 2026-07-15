import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Request } from 'express';
import { CcDisplayToken } from '../models/display-token.model';

/**
 * DisplayTokenGuard — validates opaque display tokens for TV wallboard SSE (D-26).
 *
 * Separate auth branch from JwtAuthGuard: reads ?token= query param, looks up
 * cc_display_tokens, rejects revoked/expired rows.
 *
 * Pitfall 5: req.user is set WITHOUT level/id so a leaked display token cannot
 * silently escalate if it ever hits a JWT-guarded endpoint.
 */
@Injectable()
export class DisplayTokenGuard implements CanActivate {
  constructor(
    @InjectModel(CcDisplayToken)
    private readonly displayTokenModel: typeof CcDisplayToken,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const token = req.query?.token;

    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Display token required');
    }

    const row = await this.displayTokenModel.findOne({ where: { token } });
    if (!row) {
      throw new UnauthorizedException('Display token invalid');
    }
    if (row.revoked_at != null) {
      throw new UnauthorizedException('Display token revoked');
    }
    if (row.expires_at != null && row.expires_at < new Date()) {
      throw new UnauthorizedException('Display token expired');
    }

    // Intentionally omit level/id — display tokens must never impersonate a user
    req.user = {
      vpbx_user_uid: row.user_uid,
      isDisplayToken: true,
    };

    // Fire-and-forget audit stamp — do not await SSE connect
    row.update({ last_used_at: new Date() }).catch(() => undefined);

    return true;
  }
}
