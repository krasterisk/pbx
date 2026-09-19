import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User, UserLevel } from '../users/user.model';
import { Tenant } from '../cloud-admin/tenant.model';
import type { TenantContext } from './tenant-context';

export interface VerifiedUserClaims {
  sub: number;
  level: number;
  role: number;
  vpbx_user_uid: number;
  iat: number;
}

/** Re-reads current SQL identity; a signed but stale JWT is not authorization. */
@Injectable()
export class TenantContextResolver {
  constructor(
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Tenant) private readonly tenants: typeof Tenant,
  ) {}

  async fromUserClaims(claims: VerifiedUserClaims, requestId: string, now = new Date()): Promise<TenantContext> {
    if (!claims || !Number.isSafeInteger(claims.sub) || claims.sub <= 0
      || !Number.isSafeInteger(claims.vpbx_user_uid) || claims.vpbx_user_uid < 0
      || !Number.isSafeInteger(claims.level) || !Number.isSafeInteger(claims.role)
      || !Number.isSafeInteger(claims.iat) || claims.iat <= 0) {
      throw new UnauthorizedException({ code: 'identity_invalid' });
    }
    // Platform operations use their own audited target resolver; no universal
    // superadmin bypass is available for a product tenant context.
    if (claims.level === UserLevel.SUPERADMIN) {
      throw new ForbiddenException({ code: 'platform_target_required' });
    }
    const user = await this.users.findOne({
      where: { uniqueid: claims.sub },
      attributes: [
        'uniqueid', 'level', 'role', 'vpbx_user_uid', 'isActivated',
        'activationCode', 'updatedAt',
      ],
    });
    if (!user || user.level !== claims.level || (user.role ?? 0) !== claims.role
      || user.vpbx_user_uid !== claims.vpbx_user_uid
      || (!user.isActivated && !!user.activationCode)) {
      throw new UnauthorizedException({ code: 'identity_revoked' });
    }
    const updatedAt = new Date((user as any).updatedAt).getTime();
    // JWT iat has second precision. Current membership and role are checked
    // exactly; this timestamp additionally revokes tokens after later updates.
    if (!Number.isFinite(updatedAt) || updatedAt >= (claims.iat + 1) * 1000) {
      throw new UnauthorizedException({ code: 'identity_revoked' });
    }
    const tenant = await this.tenants.findOne({
      where: { vpbx_user_uid: claims.vpbx_user_uid },
      attributes: ['vpbx_user_uid', 'status', 'trial_ends_at'],
    });
    if (!tenant || tenant.status === 'suspended' || tenant.status === 'cancelled'
      || (tenant.status === 'trial' && (!tenant.trial_ends_at
        || new Date(tenant.trial_ends_at).getTime() <= now.getTime()))) {
      throw new ForbiddenException({ code: 'tenant_inactive' });
    }
    return Object.freeze({
      tenantUid: tenant.vpbx_user_uid,
      principalId: `user:${user.uniqueid}`,
      principalKind: 'user' as const,
      permissionRevision: `${updatedAt}:${user.level}:${user.role ?? 0}:${tenant.status}`,
      requestId,
    });
  }
}
