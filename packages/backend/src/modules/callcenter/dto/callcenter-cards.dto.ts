/**
 * Call card template / data DTOs with class-validator.
 */
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
  IsObject,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/** v1 field types (14) — 'file' excluded per D-11. */
export const CARD_FIELD_TYPES = [
  'text',
  'textarea',
  'phone',
  'email',
  'select',
  'multi_select',
  'date',
  'datetime',
  'number',
  'checkbox',
  'phonebook_lookup',
  'divider',
  'heading',
  'readonly',
] as const;

export type CardFieldType = (typeof CARD_FIELD_TYPES)[number];

export const CARD_AUTO_OPEN_VALUES = ['answer', 'ring', 'manual'] as const;

export const CARD_STATUS_VALUES = ['draft', 'saved', 'missed', 'callback_done'] as const;

export class CardFieldDto {
  @IsString()
  @MaxLength(64)
  field_key: string;

  @IsIn([...CARD_FIELD_TYPES])
  field_type: CardFieldType;

  @IsString()
  @MaxLength(128)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  placeholder?: string;

  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  default_value?: string;

  @IsOptional()
  options?: unknown[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  depends_on?: string;

  @IsOptional()
  depends_values?: unknown[];

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsIn(['full', 'half'])
  width?: 'full' | 'half';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  auto_populate?: string;
}

export class CreateCardTemplateDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsIn([...CARD_AUTO_OPEN_VALUES])
  auto_open_on?: 'answer' | 'ring' | 'manual';

  @IsOptional()
  @IsBoolean()
  auto_save_on_timeout?: boolean;

  @IsOptional()
  @IsInt()
  webhook_integration_uid?: number;

  @IsOptional()
  @IsObject()
  webhook_field_map?: Record<string, string>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CardFieldDto)
  fields: CardFieldDto[];
}

export class UpdateCardTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsIn([...CARD_AUTO_OPEN_VALUES])
  auto_open_on?: 'answer' | 'ring' | 'manual';

  @IsOptional()
  @IsBoolean()
  auto_save_on_timeout?: boolean;

  @IsOptional()
  @IsInt()
  webhook_integration_uid?: number | null;

  @IsOptional()
  @IsObject()
  webhook_field_map?: Record<string, string> | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CardFieldDto)
  fields?: CardFieldDto[];
}

export class SaveCardDto {
  @IsInt()
  template_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  call_uniqueid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  caller_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  queue_name?: string;

  @IsOptional()
  @IsIn([...CARD_STATUS_VALUES])
  status?: 'draft' | 'saved' | 'missed' | 'callback_done';

  @IsObject()
  field_values: Record<string, unknown>;
}

export class UpdateCardDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  call_uniqueid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  caller_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  queue_name?: string;

  @IsOptional()
  @IsIn([...CARD_STATUS_VALUES])
  status?: 'draft' | 'saved' | 'missed' | 'callback_done';

  @IsOptional()
  @IsObject()
  field_values?: Record<string, unknown>;
}
