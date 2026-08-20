import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type {
  CallerIdMode,
  IBranchParams,
  ICallerIdActionParams,
  ICmdParams,
  IGotoParams,
  ILabelParams,
  IScheduleParams,
  ISetClidCustomParams,
  ISetClidListParams,
  ITimeGroupInterval,
  IWebhookParams,
} from '@krasterisk/shared';
import { RouteConditionDto } from '../route-condition.dto';

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

export class GotoParamsDto implements IGotoParams {
  @IsString()
  @MinLength(1)
  @Matches(SAFE_DIAL)
  label_name: string;
}

export class BranchParamsDto implements IBranchParams {
  @IsString()
  @MinLength(1)
  @Matches(SAFE_DIAL)
  true_label: string;

  @IsString()
  @MinLength(1)
  @Matches(SAFE_DIAL)
  false_label: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RouteConditionDto)
  condition?: RouteConditionDto;
}

export class TimeGroupIntervalDto implements ITimeGroupInterval {
  @IsString()
  @MinLength(1)
  time_start: string;

  @IsString()
  @MinLength(1)
  time_end: string;

  @IsString()
  @MinLength(1)
  days_of_week: string;

  @IsString()
  @MinLength(1)
  days_of_month: string;

  @IsString()
  @MinLength(1)
  months: string;
}

export class ScheduleParamsDto implements IScheduleParams {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TimeGroupIntervalDto)
  intervals: TimeGroupIntervalDto[];
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
