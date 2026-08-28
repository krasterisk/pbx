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
  ValidateNested,
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

export class CallValueSourceDto {
  @IsIn(CALL_VALUE_SOURCES)
  source: (typeof CALL_VALUE_SOURCES)[number];

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
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
