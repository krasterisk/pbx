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
  HangupSignal,
  ICallerIdActionParams,
  ICmdParams,
  IGotoParams,
  IHangupParams,
  ILabelParams,
  IScheduleParams,
  ITimeGroupInterval,
  IWebhookParams,
} from '@krasterisk/shared';
import { RouteConditionDto } from '../route-condition.dto';

const SAFE_DIAL = /^[^(),?\[\]{}$\\";\n\r]*$/;
const SAFE_TEXT = /^[^\n\r;]*$/;
const CALLERID_MODES: CallerIdMode[] = ['static', 'phonebook', 'number_list', 'carousel'];
const HANGUP_SIGNALS: HangupSignal[] = ['busy', 'congestion', 'hangup'];

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
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  phonebook_uid?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
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

/**
 * Unified jump: without `condition` it is a plain Goto, with `condition` it is
 * a two-way branch and `false_label` is the else-target.
 */
export class GotoParamsDto implements Omit<IGotoParams, 'condition'> {
  @IsString()
  @MinLength(1)
  @Matches(SAFE_DIAL)
  label_name: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RouteConditionDto)
  condition?: RouteConditionDto;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(SAFE_DIAL)
  false_label?: string;
}

export class HangupParamsDto implements IHangupParams {
  @IsOptional()
  @IsIn(HANGUP_SIGNALS)
  signal?: HangupSignal;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  timeout?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}$/)
  causecode?: string;
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
