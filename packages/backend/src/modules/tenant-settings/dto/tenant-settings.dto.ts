import {
  IsObject,
  IsOptional,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { TENANT_SETTING_KEYS } from '../tenant-settings.keys';

@ValidatorConstraint({ name: 'isTenantSettingKeys', async: false })
export class IsTenantSettingKeysConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.keys(value as Record<string, unknown>).every((k) => k in TENANT_SETTING_KEYS);
  }

  defaultMessage(): string {
    return 'settings contains keys that are not in TENANT_SETTING_KEYS';
  }
}

/** Custom validator — unknown keys are rejected by ValidationPipe, not silently dropped. */
export function IsTenantSettingKeys() {
  return Validate(IsTenantSettingKeysConstraint);
}

export class UpdateTenantSettingsDto {
  @IsObject()
  @IsTenantSettingKeys()
  settings: Record<string, unknown>;

  /** Declared so global forbidNonWhitelisted does not 400; never read — tenant is JWT-only. */
  @IsOptional()
  vpbx_user_uid?: unknown;
}
