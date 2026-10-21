import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { CallsQuery } from '@krasterisk/shared';
export class CallsQueryDto implements CallsQuery {
  @IsOptional() @IsString() @MaxLength(128) callerEmployee?: string;
  @IsOptional() @IsString() @MaxLength(128) focusEmployee?: string;
  @IsOptional() @IsString() @MaxLength(128) focusDepartment?: string;
  @IsOptional() @IsString() @MaxLength(128) focusCompanyNumber?: string;
  @IsOptional()
  @IsIn(['open', 'all'])
  attentionView?: CallsQuery['attentionView'];
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(['employee', 'department', 'companyNumber'], { each: true })
  unassignedDimensions?: CallsQuery['unassignedDimensions'];
  @IsOptional()
  @IsIn([
    'human',
    'robot',
    'voicemail',
    'menu',
    'missed',
    'error',
    'unknown',
    'active',
  ])
  focusOutcome?: CallsQuery['focusOutcome'];
  @IsOptional() @IsString() @MaxLength(50) from?: string;
  @IsOptional() @IsString() @MaxLength(50) to?: string;
  @IsOptional()
  @IsIn(['telephony', 'autodial', 'ai'])
  origin?: CallsQuery['origin'];
  @IsOptional()
  @IsIn(['accepted', 'missed', 'unknown', 'active'])
  dashboardOutcome?: CallsQuery['dashboardOutcome'];
  @IsOptional() @IsString() @MaxLength(10) dateFrom?: string;
  @IsOptional() @IsString() @MaxLength(10) dateTo?: string;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsString() @MaxLength(128) directorySearch?: string;
  @IsOptional()
  @IsIn(['in', 'out', 'internal', 'external'])
  direction?: CallsQuery['direction'];
  @IsOptional()
  @IsIn([
    'human',
    'robot',
    'voicemail',
    'menu',
    'missed',
    'error',
    'unknown',
    'active',
  ])
  outcome?: CallsQuery['outcome'];
  @IsOptional()
  @IsIn(['employee', 'queue', 'menu', 'voiceRobot', 'aiRobot', 'autodial'])
  handling?: CallsQuery['handling'];
  @IsOptional() @IsString() @MaxLength(40) extension?: string;
  @IsOptional() @IsString() @MaxLength(128) companyNumber?: string;
  @IsOptional() @IsString() @MaxLength(128) department?: string;
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  employees?: string[];
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  departments?: string[];
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  companyNumbers?: string[];
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  queues?: string[];
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  robots?: string[];
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(
    [
      'human',
      'robot',
      'voicemail',
      'menu',
      'missed',
      'error',
      'unknown',
      'active',
    ],
    { each: true },
  )
  outcomes?: CallsQuery['outcomes'];
  @IsOptional() @IsIn(['yes', 'no']) recording?: CallsQuery['recording'];
  @IsOptional() @IsIn(['1']) voicemail?: '1';
  @IsOptional()
  @IsIn(['none', 'queued', 'running', 'analyzed', 'failed'])
  analytics?: CallsQuery['analytics'];
  @IsOptional() @IsString() @MaxLength(300) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
