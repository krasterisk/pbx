import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  DirectoryBehaviorType,
  DirectoryFieldType,
  DirectoryKeyNormalization,
  DirectoryMatchKind,
  DirectoryMatchMode,
} from '@krasterisk/shared';

const FIELD_TYPES: DirectoryFieldType[] = ['string', 'phone', 'number', 'boolean'];
const MATCH_KINDS: DirectoryMatchKind[] = ['exact', 'asterisk_pattern'];
const KEY_NORMALIZATIONS: DirectoryKeyNormalization[] = ['none', 'digits'];
const MATCH_MODES: DirectoryMatchMode[] = ['on_match', 'on_no_match'];
const BEHAVIOR_TYPES: DirectoryBehaviorType[] = [
  'set_name',
  'set_number',
  'drop',
  'redirect',
  'map_fields',
  'custom',
];
const CALL_VALUE_SOURCES = [
  'fixed',
  'route_pattern',
  'variable',
  'original_caller',
  'current_caller',
] as const;

export class DirectoryFieldDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  key: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  label: string;

  @IsIn(FIELD_TYPES)
  type: DirectoryFieldType;

  @IsBoolean()
  required: boolean;

  @IsInt()
  @Min(0)
  position: number;
}

export class DirectoryRecordDto {
  @IsIn(MATCH_KINDS)
  match_kind: DirectoryMatchKind;

  @IsInt()
  @Min(1)
  priority: number;

  @IsObject()
  values: Record<string, string | number | boolean>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  comment?: string;
}

export class DirectoryFieldMappingDto {
  @IsInt()
  @Min(1)
  fieldUid: number;

  @IsString()
  @MinLength(1)
  targetVariable: string;
}

export class DirectoryBehaviorParamsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  fieldUid?: number;

  @IsOptional()
  @IsString()
  fixed?: string;

  @IsOptional()
  @IsString()
  fixedExten?: string;

  @IsOptional()
  @IsString()
  targetContext?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectoryFieldMappingDto)
  mappings?: DirectoryFieldMappingDto[];
}

@ValidatorConstraint({ name: 'isCallValueSource', async: false })
export class IsCallValueSourceConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const src = value as Record<string, unknown>;
    if (!CALL_VALUE_SOURCES.includes(src.source as (typeof CALL_VALUE_SOURCES)[number])) {
      return false;
    }
    if (src.source === 'fixed') {
      return typeof src.value === 'string' && src.value.trim().length > 0 && src.name === undefined;
    }
    if (src.source === 'variable') {
      return typeof src.name === 'string' && src.name.trim().length > 0 && src.value === undefined;
    }
    return src.value === undefined && src.name === undefined;
  }

  defaultMessage(): string {
    return 'key_source must be fixed (non-empty value), route_pattern, variable (non-empty name), original_caller, or current_caller';
  }
}

export class CallValueSourceDto {
  @IsIn(CALL_VALUE_SOURCES)
  source: (typeof CALL_VALUE_SOURCES)[number];

  @ValidateIf((o) => o.source === 'fixed')
  @IsString()
  @MinLength(1)
  value?: string;

  @ValidateIf((o) => o.source === 'variable')
  @IsString()
  @MinLength(1)
  name?: string;
}

export class CreateDirectoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lookupFieldKey: string;

  @IsIn(KEY_NORMALIZATIONS)
  key_normalization: DirectoryKeyNormalization;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectoryFieldDto)
  fields: DirectoryFieldDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectoryRecordDto)
  records?: DirectoryRecordDto[];
}

export class UpdateDirectoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lookupFieldKey?: string;

  @IsOptional()
  @IsIn(KEY_NORMALIZATIONS)
  key_normalization?: DirectoryKeyNormalization;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectoryFieldDto)
  fields?: DirectoryFieldDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectoryRecordDto)
  records?: DirectoryRecordDto[];
}

export class RouteDirectoryBindingDto {
  @IsInt()
  @Min(1)
  directory_uid: number;

  @IsInt()
  @Min(0)
  position: number;

  @IsObject()
  @ValidateNested()
  @Type(() => CallValueSourceDto)
  @Validate(IsCallValueSourceConstraint)
  key_source: CallValueSourceDto;

  @IsIn(MATCH_MODES)
  match_mode: DirectoryMatchMode;

  @IsIn(BEHAVIOR_TYPES)
  behavior_type: DirectoryBehaviorType;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DirectoryBehaviorParamsDto)
  behavior_params?: DirectoryBehaviorParamsDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  actions?: object[] | null;
}
