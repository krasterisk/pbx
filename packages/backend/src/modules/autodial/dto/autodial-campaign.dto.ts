import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AUTODIAL_DIAL_MODES,
  AUTODIAL_DISPOSITIONS,
  AUTODIAL_SCHEDULE_KINDS,
  type AutodialDialMode,
  type AutodialDisposition,
  type AutodialScheduleKind,
} from '@krasterisk/shared';

export class AutodialPacingProviderDto {
  @IsIn(['static', 'queue_agents', 'trunk_channels', 'tenant_cap'])
  type!: 'static' | 'queue_agents' | 'trunk_channels' | 'tenant_cap';

  @IsOptional()
  @IsInt()
  @Min(1)
  max_channels?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  queue_names?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  ratio?: number;
}

export class AutodialPredictiveDto {
  /** Regulators cap this in the low single digits; 20 is the absurdity guard. */
  @IsNumber()
  @Min(0)
  @Max(20)
  target_abandon_pct!: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  max_over_dial!: number;

  @IsInt()
  @Min(1)
  min_samples!: number;
}

export class AutodialPacingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutodialPacingProviderDto)
  providers!: AutodialPacingProviderDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  power_ratio?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AutodialPredictiveDto)
  predictive?: AutodialPredictiveDto;
}

export class AutodialRetryDto {
  @IsInt()
  @Min(1)
  max_attempts!: number;

  @IsOptional()
  intervals_sec?: Partial<Record<AutodialDisposition, number>>;

  @IsInt()
  @Min(0)
  default_interval_sec!: number;
}

export class AutodialTrunkPoolItemDto {
  @IsString()
  @MaxLength(128)
  trunk_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  caller_id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  weight?: number;

  /** 0 / omitted = no limit tracked for this trunk */
  @IsOptional()
  @IsInt()
  @Min(0)
  max_channels?: number;
}

export class AutodialCidPolicyDto {
  @IsIn(['static', 'rotate', 'per_trunk'])
  mode!: 'static' | 'rotate' | 'per_trunk';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  value?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pool?: string[];
}

export class AutodialAmdDto {
  @IsBoolean()
  enabled!: boolean;

  @IsIn(['hangup', 'continue', 'voicemail'])
  on_machine!: 'hangup' | 'continue' | 'voicemail';
}

export class AutodialScheduleDraftDto {
  @IsOptional()
  @IsInt()
  uid?: number;

  @IsIn([...AUTODIAL_SCHEDULE_KINDS])
  kind!: AutodialScheduleKind;

  @IsOptional()
  @IsInt()
  @Min(0)
  weekday?: number | null;

  @IsString()
  @MaxLength(5)
  time_from!: string;

  @IsString()
  @MaxLength(5)
  time_to!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsString()
  date_from?: string | null;

  @IsOptional()
  @IsString()
  date_to?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateAutodialCampaignDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsIn([...AUTODIAL_DIAL_MODES])
  dial_mode?: AutodialDialMode;

  @IsInt()
  @Min(1)
  base_uid!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AutodialPacingDto)
  pacing?: AutodialPacingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AutodialRetryDto)
  retry?: AutodialRetryDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutodialTrunkPoolItemDto)
  trunk_pool?: AutodialTrunkPoolItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AutodialCidPolicyDto)
  cid_policy?: AutodialCidPolicyDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  queue_names?: string[];

  @IsOptional()
  scenario_actions?: unknown[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AutodialAmdDto)
  amd?: AutodialAmdDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  success_min_sec?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  dial_timeout_sec?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutodialScheduleDraftDto)
  schedules?: AutodialScheduleDraftDto[];
}

export class UpdateAutodialCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn([...AUTODIAL_DIAL_MODES])
  dial_mode?: AutodialDialMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  base_uid?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AutodialPacingDto)
  pacing?: AutodialPacingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AutodialRetryDto)
  retry?: AutodialRetryDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutodialTrunkPoolItemDto)
  trunk_pool?: AutodialTrunkPoolItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AutodialCidPolicyDto)
  cid_policy?: AutodialCidPolicyDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  queue_names?: string[];

  @IsOptional()
  scenario_actions?: unknown[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AutodialAmdDto)
  amd?: AutodialAmdDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  success_min_sec?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  dial_timeout_sec?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutodialScheduleDraftDto)
  schedules?: AutodialScheduleDraftDto[];
}

/** D-19: filter contacts by prior task dispositions when (re)starting. */
export class StartAutodialCampaignDto {
  @IsOptional()
  @IsArray()
  @IsIn([...AUTODIAL_DISPOSITIONS], { each: true })
  include_dispositions?: AutodialDisposition[];

  @IsOptional()
  @IsBoolean()
  skip_existing_tasks?: boolean;
}

export class CreateAutodialDncDto {
  @IsIn(['global', 'campaign', 'base'])
  scope!: 'global' | 'campaign' | 'base';

  @IsOptional()
  @IsInt()
  scope_uid?: number | null;

  @IsString()
  @MaxLength(64)
  normalized_phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;

  @IsOptional()
  @IsString()
  expires_at?: string | null;
}
