import {
  IsString, IsOptional, IsBoolean, IsNumber, IsIn, IsArray, ValidateNested, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateHubModuleDto {
  @IsString()
  @MaxLength(64)
  code: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsIn(['base', 'market'])
  kind: 'base' | 'market';

  @IsOptional()
  @IsNumber()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  requires_cloud?: boolean;
}

export class UpdateHubModuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsIn(['base', 'market'])
  kind?: 'base' | 'market';

  @IsOptional()
  @IsNumber()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  requires_cloud?: boolean;
}

export class HubModulePageItemDto {
  @IsString()
  @MaxLength(64)
  page_code: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  path?: string | null;

  @IsOptional()
  @IsNumber()
  sort_order?: number;
}

export class ReplaceHubModulePagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HubModulePageItemDto)
  pages: HubModulePageItemDto[];
}

export class ReorderHubModulesDto {
  @IsArray()
  @IsString({ each: true })
  codes: string[];
}
