import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TEMPLATE_SLOT_KINDS, type TemplateSlotKind } from '@krasterisk/shared';

export class TemplateSlotDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id: string;

  @IsIn([...TEMPLATE_SLOT_KINDS])
  kind: TemplateSlotKind;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  label: string;
}

export class CreateRouteTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @IsArray()
  actions: Record<string, unknown>[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateSlotDto)
  slots: TemplateSlotDto[];
}

export class UpdateRouteTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @IsOptional()
  @IsArray()
  actions?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateSlotDto)
  slots?: TemplateSlotDto[];
}

export class ApplyRouteTemplateDto {
  @IsObject()
  slotValues: Record<string, { uid: string | number; name?: string }>;

  @IsOptional()
  @IsIn(['replace', 'append'])
  mode?: 'replace' | 'append';
}
