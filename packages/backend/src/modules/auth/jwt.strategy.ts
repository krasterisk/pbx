import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayloadUser } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'krasterisk-v4-secret'),
    });
  }

  /**
   * Called after Passport verifies the JWT signature.
   * Returns req.user — validated from the payload (no extra DB query).
   *
   * The payload already contains all fields we need: sub, level,
   * vpbx_user_uid, etc. These are refreshed on every token rotation.
   */
  validate(payload: JwtPayloadUser): JwtPayloadUser {
    return this.authService.validateJwtPayload(payload);
  }
}
