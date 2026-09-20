import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { col, fn, where } from 'sequelize';
import { User } from '../users/user.model';
import { TenantContextResolver, type VerifiedUserClaims } from '../integration-credentials/tenant-context.resolver';

const DUMMY_HASH = '$2b$12$C2B5CkmOFp2WgbQT0CGJa.Y/ZHhLCHmrRITvOxVotT0KRA8WjUaqq';

/** Access-token login for independently installed AI products. No PBX AuthModule. */
@Injectable()
export class StandaloneLoginService {
  constructor(
    @InjectModel(User) private readonly users: typeof User,
    private readonly jwt: JwtService,
    private readonly tenantContext: TenantContextResolver,
  ) {}

  async login(login: string, password: string): Promise<{
    accessToken: string;
    expiresInSeconds: number;
    user: { uniqueid: number; login: string; name: string };
  }> {
    const normalized = login.trim().toLowerCase();
    const user = normalized ? await this.users.findOne({
      where: where(fn('LOWER', col('login')), normalized),
    }) : null;
    const stored = user?.passwd == null ? '' : String(user.passwd);
    const hash = stored.startsWith('$2') ? stored : DUMMY_HASH;
    let valid = false;
    try {
      valid = await bcrypt.compare(password, hash);
    } catch {
      valid = false;
    }
    if (!user || !valid) throw new UnauthorizedException({ code: 'credential_invalid' });

    // Reuse the same current-state tenant validation as integration endpoints.
    const claims: Omit<VerifiedUserClaims, 'iat'> = {
      sub: Number(user.uniqueid),
      level: Number(user.level),
      role: Number(user.role ?? 0),
      vpbx_user_uid: Number(user.vpbx_user_uid),
    };
    const accessToken = this.jwt.sign(claims);
    const verified = this.jwt.decode(accessToken) as VerifiedUserClaims;
    await this.tenantContext.fromUserClaims(verified, 'standalone-login');
    return {
      accessToken, expiresInSeconds: 7200,
      user: { uniqueid: user.uniqueid, login: user.login, name: user.name },
    };
  }
}
