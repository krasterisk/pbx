import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type {
  CallerIdMode,
  ICallerIdActionParams,
  ICmdParams,
  ILabelParams,
  ISetClidCustomParams,
  ISetClidListParams,
  IWebhookParams,
} from '@krasterisk/shared';

const SAFE_DIAL = /^[^(),?\[\]{}$\\";\n\r]*$/;
const SAFE_TEXT = /^[^\n\r;]*$/;
const CALLERID_MODES: CallerIdMode[] = ['static', 'phonebook', 'setclid_list', 'carousel'];

export class SetClidCustomParamsDto implements ISetClidCustomParams {
  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  callerid?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  name?: string;

  @IsOptional()
  @IsString()
  mode?: string;
}

export class SetClidListParamsDto implements ISetClidListParams {
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  list_uid?: number;

  @IsOptional()
  @IsString()
  mode?: string;
}

export class CallerIdParamsDto implements ICallerIdActionParams {
  @IsIn(CALLERID_MODES)
  mode: CallerIdMode;

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  callerid?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  phonebook_uid?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  list_uid?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pool?: string[];
}

export class LabelParamsDto implements ILabelParams {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(SAFE_DIAL)
  label_name?: string;
}

export class CmdParamsDto implements ICmdParams {
  @IsOptional()
  @IsString()
  @Matches(/^[^\n\r]*$/)
  command?: string;
}

export class WebhookParamsDto implements IWebhookParams {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(SAFE_TEXT)
  url?: string;
}
