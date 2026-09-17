import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AUTODIAL_DEDUP_POLICIES,
  AUTODIAL_FIELD_TYPES,
  AUTODIAL_PHONE_NORMALIZATIONS,
  type AutodialDedupPolicy,
  type AutodialFieldType,
  type AutodialPhoneNormalization,
} from '@krasterisk/shared';

export const AUTODIAL_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

export class AutodialFieldDraftDto {
  @IsOptional()
  @IsInt()
  uid?: number;

  @IsString()
  @Matches(AUTODIAL_FIELD_KEY_PATTERN)
  key!: string;

  @IsString()
  @MaxLength(255)
  label!: string;

  @IsIn([...AUTODIAL_FIELD_TYPES])
  type!: AutodialFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  is_phone?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  var_name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enum_values?: string[];
}

export class CreateAutodialBaseDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @IsOptional()
  @IsIn([...AUTODIAL_DEDUP_POLICIES])
  dedup_policy?: AutodialDedupPolicy;

  @IsOptional()
  @IsIn([...AUTODIAL_PHONE_NORMALIZATIONS])
  phone_normalization?: AutodialPhoneNormalization;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutodialFieldDraftDto)
  fields!: AutodialFieldDraftDto[];
}

export class UpdateAutodialBaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @IsOptional()
  @IsIn([...AUTODIAL_DEDUP_POLICIES])
  dedup_policy?: AutodialDedupPolicy;

  @IsOptional()
  @IsIn([...AUTODIAL_PHONE_NORMALIZATIONS])
  phone_normalization?: AutodialPhoneNormalization;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutodialFieldDraftDto)
  fields?: AutodialFieldDraftDto[];
}

export class AutodialPhoneDraftDto {
  @IsString()
  @MaxLength(64)
  raw!: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsInt()
  tz_offset_min?: number;
}

export class CreateAutodialContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  external_id?: string;

  /** Field values keyed by field.key */
  values!: Record<string, string | number | boolean>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutodialPhoneDraftDto)
  phones!: AutodialPhoneDraftDto[];

  @IsOptional()
  @IsString()
  @MaxLength(512)
  comment?: string;
}

export class UpdateAutodialContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  external_id?: string | null;

  @IsOptional()
  values?: Record<string, string | number | boolean>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutodialPhoneDraftDto)
  phones?: AutodialPhoneDraftDto[];

  @IsOptional()
  @IsString()
  @MaxLength(512)
  comment?: string;
}
