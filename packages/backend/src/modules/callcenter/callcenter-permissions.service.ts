/**
 * Server-authoritative granular-permission resolver (D-38/D-39).
 *
 * Single place every downstream capability (peer ChanSpy, click-to-call, customize_ui)
 * consults for the *effective* right: role default (`cc_settings.role_permission_defaults`,
 * keyed by the operator's UserLevel) overlaid by the per-operator override
 * (`cc_operator_settings`), unless the tenant lock for that right is set — a locked
 * right always resolves to the role default, ignoring any operator column value (D-06).
 *
 * Never trust a client-sent permission flag — effective rights are always resolved here,
 * from the DB, server-side.
 */
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CcOperatorSettings } from './models/operator-settings.model';
import { CcSettings } from './models/cc-settings.model';
import { User, UserLevel } from '../users/user.model';
import type { PermissionSet, SpyMode } from './models/cc-permissions.types';

/** Boolean rights on PermissionSet (spy_modes is an array, resolved separately). */
type BooleanRight = 'can_spy' | 'spyable' | 'click_to_call' | 'customize_ui';

const BOOLEAN_RIGHTS: BooleanRight[] = ['can_spy', 'spyable', 'click_to_call', 'customize_ui'];

/** Missing operator row AND missing role default → these hardcoded safe defaults apply. */
export const SAFE_DEFAULT_PERMISSIONS: PermissionSet = {
  can_spy: false,
  spyable: true,
  spy_modes: ['listen'],
  click_to_call: false,
  customize_ui: false,
};

@Injectable()
export class CallCenterPermissionsService {
  constructor(
    @InjectModel(CcOperatorSettings)
    private readonly operatorSettingsModel: typeof CcOperatorSettings,
    @InjectModel(CcSettings)
    private readonly ccSettingsModel: typeof CcSettings,
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  /**
   * Resolves the effective PermissionSet for one operator.
   * Missing operator row → pure role default. Missing role default → SAFE_DEFAULT_PERMISSIONS.
   * A locked right always resolves to the role default, regardless of the operator column value.
   */
  async getEffective(userUid: number, operatorUserId: number): Promise<PermissionSet> {
    const operatorUser = await this.userModel.findOne({
      where: { id: operatorUserId, vpbx_user_uid: userUid },
    });
    const level = (operatorUser?.getDataValue('level') as UserLevel | undefined) ?? undefined;

    const tenantSettings = await this.ccSettingsModel.findOne({ where: { user_uid: userUid } });
    const roleDefault: Partial<PermissionSet> =
      (level != null && tenantSettings?.role_permission_defaults?.[level]) || {};
    const locks: Partial<Record<keyof PermissionSet, boolean>> =
      (level != null && tenantSettings?.permission_locks?.[level]) || {};

    const operatorRow = await this.operatorSettingsModel.findOne({
      where: { user_uid: userUid, operator_user_id: operatorUserId },
    });

    const result = {} as PermissionSet;

    for (const right of BOOLEAN_RIGHTS) {
      const roleValue = roleDefault[right] ?? SAFE_DEFAULT_PERMISSIONS[right];
      if (locks[right]) {
        result[right] = roleValue;
        continue;
      }
      result[right] = operatorRow ? operatorRow.getDataValue(right) : roleValue;
    }

    const roleSpyModes = roleDefault.spy_modes ?? SAFE_DEFAULT_PERMISSIONS.spy_modes;
    result.spy_modes = locks.spy_modes
      ? roleSpyModes
      : operatorRow
        ? (operatorRow.getDataValue('spy_modes') as SpyMode[]) ?? roleSpyModes
        : roleSpyModes;

    return result;
  }

  /** Throws ForbiddenException when the effective boolean right is false. */
  async assert(userUid: number, operatorUserId: number, right: BooleanRight): Promise<PermissionSet> {
    const perms = await this.getEffective(userUid, operatorUserId);
    if (!perms[right]) {
      throw new ForbiddenException(`${right} not granted`);
    }
    return perms;
  }

  /** Throws ForbiddenException when `mode` is not in the operator's effective spy_modes. */
  async assertSpyMode(userUid: number, operatorUserId: number, mode: SpyMode): Promise<PermissionSet> {
    const perms = await this.getEffective(userUid, operatorUserId);
    if (!perms.spy_modes.includes(mode)) {
      throw new ForbiddenException(`Mode ${mode} not granted`);
    }
    return perms;
  }
}
