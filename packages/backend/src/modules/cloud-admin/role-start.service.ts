import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserLevel } from '../users/user.model';
import { RoleStartDefault, TenantRoleStart } from './models/role-start.model';

export interface RoleStartModuleState {
  /** When false, CC role defaults fall back to Overview (D-16). Default true. */
  callCenterEnabled?: boolean;
}

const OVERVIEW = '/';
const CC_AGENT = '/callcenter/agent';
const CC_SUPERVISOR = '/callcenter/supervisor';

function hardcodedDefault(level: UserLevel | number | undefined): string {
  switch (level) {
    case UserLevel.OPERATOR:
      return CC_AGENT;
    case UserLevel.SUPERVISOR:
      return CC_SUPERVISOR;
    case UserLevel.ADMIN:
    case UserLevel.SUPERADMIN:
    case UserLevel.READONLY:
    default:
      return OVERVIEW;
  }
}

function isCallCenterPath(path: string): boolean {
  return path.startsWith('/callcenter/');
}

@Injectable()
export class RoleStartService {
  constructor(
    @InjectModel(RoleStartDefault) private readonly defaultsModel: typeof RoleStartDefault,
    @InjectModel(TenantRoleStart) private readonly tenantModel: typeof TenantRoleStart,
  ) {}

  /**
   * Resolve start path: tenant override → platform default → D-16 hardcoded.
   * CC-off still falls back to Overview for CC paths (D-16).
   */
  async resolveStart(
    level: UserLevel | number | undefined,
    tenantId: number | null | undefined,
    tenantModuleState: RoleStartModuleState = {},
  ): Promise<string> {
    const callCenterEnabled = tenantModuleState.callCenterEnabled !== false;
    let path: string | null = null;

    if (tenantId != null && level != null) {
      const override = await this.tenantModel.findOne({
        where: { tenant_id: tenantId, user_level: level },
      });
      if (override?.start_path) path = override.start_path;
    }

    if (!path && level != null) {
      const def = await this.defaultsModel.findOne({ where: { user_level: level } });
      if (def?.start_path) path = def.start_path;
    }

    if (!path) path = hardcodedDefault(level);

    if (!callCenterEnabled && isCallCenterPath(path)) {
      return OVERVIEW;
    }
    return path;
  }

  async listDefaults(): Promise<RoleStartDefault[]> {
    return this.defaultsModel.findAll({ order: [['user_level', 'ASC']] });
  }

  async listTenantOverrides(tenantId: number): Promise<TenantRoleStart[]> {
    return this.tenantModel.findAll({
      where: { tenant_id: tenantId },
      order: [['user_level', 'ASC']],
    });
  }

  /** Platform SuperAdmin writes role_start_defaults (D-04). */
  async upsertDefaults(
    rows: Array<{ user_level: number; start_path: string }>,
  ): Promise<RoleStartDefault[]> {
    for (const row of rows) {
      await this.defaultsModel.upsert({
        user_level: row.user_level,
        start_path: row.start_path,
      } as any);
    }
    return this.listDefaults();
  }

  /**
   * Tenant ADMIN writes tenant_role_start for own tenant only (D-04).
   * Never accept a different tenant_id from the client body.
   */
  async upsertTenantOverrides(
    tenantId: number,
    rows: Array<{ user_level: number; start_path: string }>,
  ): Promise<TenantRoleStart[]> {
    for (const row of rows) {
      await this.tenantModel.upsert({
        tenant_id: tenantId,
        user_level: row.user_level,
        start_path: row.start_path,
      } as any);
    }
    return this.listTenantOverrides(tenantId);
  }
}
