import { CONTEXT_IDENTIFIER_PATTERN, CONTEXT_IDENTIFIER_MAX_LENGTH, CONTEXT_IDENTIFIER_ERROR } from '@krasterisk/shared';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Matches, Min } from 'class-validator';

export class CreateContextDto {
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true })
  include_uids?: number[];
  @IsString()
  @IsNotEmpty()
  @Matches(CONTEXT_IDENTIFIER_PATTERN, { message: CONTEXT_IDENTIFIER_ERROR })
  @MaxLength(CONTEXT_IDENTIFIER_MAX_LENGTH)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  is_default_for_endpoints?: boolean;

  @IsOptional()
  @IsBoolean()
  is_default_for_trunks?: boolean;
}

export class UpdateContextDto {
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true })
  include_uids?: number[];
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(CONTEXT_IDENTIFIER_PATTERN, { message: CONTEXT_IDENTIFIER_ERROR })
  @MaxLength(CONTEXT_IDENTIFIER_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  is_default_for_endpoints?: boolean;

  @IsOptional()
  @IsBoolean()
  is_default_for_trunks?: boolean;
}
