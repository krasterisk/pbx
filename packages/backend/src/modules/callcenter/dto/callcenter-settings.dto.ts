/**
 * Call Center settings DTOs (D-22 operator settings, D-27 tenant thresholds,
 * D-05/D-06/D-38...D-43 UI customization / granular permissions / notification matrix).
 * Intentionally omit operator_user_id / user_uid — IDs come from session (IDOR mitigation).
 */
import {
  ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, Min, Max,
} from 'class-validator';
import type { SoftphonePlacement, SpyMode } from '../models/cc-permissions.types';

const SOFTPHONE_PLACEMENTS: SoftphonePlacement[] = ['bottom-right', 'bottom-left', 'hidden'];
const SPY_MODES: SpyMode[] = ['listen', 'whisper', 'barge'];

export class UpdateOperatorSettingsDto {
  @IsOptional()
  @IsBoolean()
  pickup_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  auto_answer?: boolean;

  @IsOptional()
  @IsBoolean()
  auto_answer_zip_tone?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  wrapup_timeout?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  wrapup_extend_step?: number;

  @IsOptional()
  @IsBoolean()
  wrapup_autosave_draft?: boolean;

  @IsOptional()
  @IsBoolean()
  sound_incoming?: boolean;

  @IsOptional()
  @IsBoolean()
  sound_missed?: boolean;

  @IsOptional()
  @IsBoolean()
  notifications_enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  volume?: number;
}

export class UpdateCcSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  default_sla_threshold?: number;

  @IsOptional()
  @IsBoolean()
  alert_sound_enabled?: boolean;

  /** Whitelisted keys enforced in service (T-07-05-04). */
  @IsOptional()
  @IsObject()
  alert_thresholds?: Record<string, unknown>;
}

/** D-05: tab/panel visibility + softphone placement. Locked keys rejected server-side (D-06). */
export class UpdateUiCustomizationDto {
  /** Keys are UI-SPEC surface ids (coworkers/queues/waiting/...); values on/off. */
  @IsOptional()
  @IsObject()
  ui_visibility?: Record<string, boolean>;

  @IsOptional()
  @IsIn(SOFTPHONE_PLACEMENTS)
  softphone_placement?: SoftphonePlacement;
}

/**
 * D-38/D-21/D-22: per-operator granular rights. Locked rights (per role, D-06/D-39)
 * are ignored server-side — see CallCenterSettingsService.updateOperatorPermissions.
 */
export class UpdatePermissionsDto {
  @IsOptional()
  @IsBoolean()
  can_spy?: boolean;

  @IsOptional()
  @IsBoolean()
  spyable?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(SPY_MODES, { each: true })
  spy_modes?: SpyMode[];

  @IsOptional()
  @IsBoolean()
  click_to_call?: boolean;

  @IsOptional()
  @IsBoolean()
  customize_ui?: boolean;
}

/** D-41/D-42/D-43: event × channel notification matrix. Whitelisted in service. */
export class UpdateNotificationMatrixDto {
  @IsOptional()
  @IsObject()
  notification_matrix?: Record<string, unknown>;
}

/**
 * D-39/D-43: tenant role-default + lock update body — shared shape for all three
 * `tenant/*-defaults` endpoints; each endpoint only reads/writes the fields relevant
 * to it (unused fields are ignored server-side, not an error).
 */
export class UpdateRoleDefaultsDto {
  /** tenant/permissions-defaults: role default PermissionSet, keyed by UserLevel. */
  @IsOptional()
  @IsObject()
  role_permission_defaults?: Record<string, unknown>;

  /** tenant/permissions-defaults: per-right lock flags, keyed by UserLevel. */
  @IsOptional()
  @IsObject()
  permission_locks?: Record<string, unknown>;

  /** tenant/ui-defaults: role-default tab/panel visibility (flat, not per-level). */
  @IsOptional()
  @IsObject()
  ui_visibility_defaults?: Record<string, boolean>;

  /** tenant/ui-defaults: ui_visibility keys locked for operator self-override. */
  @IsOptional()
  @IsObject()
  ui_visibility_locks?: Record<string, boolean>;

  /** tenant/notification-defaults: role-default notification matrix (flat). */
  @IsOptional()
  @IsObject()
  notification_defaults?: Record<string, unknown>;

  /** tenant/notification-defaults: events locked for operator self-override. */
  @IsOptional()
  @IsObject()
  notification_locks?: Record<string, unknown>;
}
