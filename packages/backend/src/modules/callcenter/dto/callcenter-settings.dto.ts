/**
 * Call Center settings DTOs (D-22 operator settings, D-27 tenant thresholds).
 * Intentionally omit operator_user_id / user_uid — IDs come from session (IDOR mitigation).
 */
import {
  IsBoolean, IsInt, IsObject, IsOptional, Min, Max,
} from 'class-validator';

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
