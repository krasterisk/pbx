import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CC_REPORT_IDS } from '../callcenter-reports.types';

const PERIOD_PRESETS = [
  'today',
  'yesterday',
  'last-7-days',
  'last-30-days',
  'previous-month',
] as const;

export class CreateReportScheduleDto {
  @IsString()
  @MaxLength(128)
  name!: string;

  @IsIn([...CC_REPORT_IDS])
  report_id!: string;

  @IsIn(['csv', 'xlsx'])
  format!: 'csv' | 'xlsx';

  @IsIn([...PERIOD_PRESETS])
  period_preset!: (typeof PERIOD_PRESETS)[number];

  @IsOptional()
  @IsObject()
  filters?: { queueName?: string; agentInterface?: string };

  @IsIn(['daily', 'weekly', 'monthly'])
  frequency!: 'daily' | 'weekly' | 'monthly';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  hour!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(59)
  minute!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  day_of_month?: number;

  @Type(() => Number)
  @IsInt()
  integration_uid!: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  target?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  subject_template?: string;

  @IsOptional()
  @IsString()
  message_template?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateReportScheduleDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsIn([...CC_REPORT_IDS])
  report_id?: string;

  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx';

  @IsOptional()
  @IsIn([...PERIOD_PRESETS])
  period_preset?: (typeof PERIOD_PRESETS)[number];

  @IsOptional()
  @IsObject()
  filters?: { queueName?: string; agentInterface?: string };

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  frequency?: 'daily' | 'weekly' | 'monthly';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  hour?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(59)
  minute?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  day_of_month?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  integration_uid?: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  target?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  subject_template?: string | null;

  @IsOptional()
  @IsString()
  message_template?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
