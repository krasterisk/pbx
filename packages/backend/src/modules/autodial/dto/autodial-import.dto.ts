import { Type } from 'class-transformer';
import {
  IsArray, IsBase64, IsBoolean, IsIn, IsInt, IsOptional, IsString,
  MaxLength, Min, ValidateNested,
} from 'class-validator';
import type { AutodialDedupPolicy, AutodialImportSource, IAutodialColumnMap } from '@krasterisk/shared';

class AutodialColumnMapDto implements IAutodialColumnMap {
  @IsString()
  @MaxLength(512)
  column!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  column_index?: number;

  @IsString()
  @MaxLength(64)
  field_key!: string;

  @IsOptional()
  @IsIn(['trim', 'phone_normalize', 'date_iso', 'money_cents', 'none'])
  transform?: IAutodialColumnMap['transform'];
}

export class AutodialImportUploadDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  filename?: string;

  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  source?: AutodialImportSource;

  @IsString()
  @MaxLength(Math.ceil(20 * 1024 * 1024 / 3) * 4)
  @IsBase64()
  content_base64!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  profile_uid?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutodialColumnMapDto)
  column_map?: AutodialColumnMapDto[];

  @IsOptional()
  @IsIn(['', ',', ';', '\t', '|'])
  delimiter?: string;

  @IsOptional()
  @IsBoolean()
  has_header?: boolean;

  @IsOptional()
  @IsIn(['phone', 'external_id', 'none'])
  dedup_policy?: AutodialDedupPolicy;

  @IsOptional()
  @IsBoolean()
  replace?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  expected_revision?: number;
}
