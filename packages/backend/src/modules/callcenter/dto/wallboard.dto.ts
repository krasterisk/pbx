/**
 * Wallboard DTOs (D-26 display tokens + D-28 alert routing).
 * Never accept token / user_uid / created_by from the client.
 */
import {
  IsOptional, IsString, IsInt, IsBoolean, Min, Max, MaxLength,
} from 'class-validator';

export class CreateDisplayTokenDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  label?: string;

  /** Optional TTL in days; server converts to expires_at. */
  @IsOptional()
  @IsInt()
  @Min(1)
  expires_in_days?: number;
}

export class UpdateAlertConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  integration_uid?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  target?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  cooldown_sec?: number;
}
