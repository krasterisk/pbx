import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type {
  IMediaOptions,
  IMediaParams,
  IRecordParams,
  IText2SpeechParams,
  IToFaxParams,
  IVoiceRobotParams,
  MediaMixMode,
} from '@krasterisk/shared';
import { parseOptions, serializeOptions } from '../../../../shared/utils/dialplan-options.util';

const MIX_MODES = ['say', 'mix'] as const;
const SAFE_TEXT = /^[^\n\r;]*$/;
const RAW_FLAGS = /^[A-Za-z0-9().,:_-]*$/;

export function parseMediaOptions(input: string): IMediaOptions {
  const result: IMediaOptions = {};
  const rawParts: string[] = [];
  for (const token of parseOptions(input).tokens) {
    if (token === 'say') {
      result.mixMode = 'say';
      continue;
    }
    if (token === 'mix') {
      result.mixMode = 'mix';
      continue;
    }
    if (token === 'n') {
      result.noanswer = true;
      continue;
    }
    if (token === 's') {
      result.skip = true;
      continue;
    }
    if (token === 'p') {
      result.p = true;
      continue;
    }
    rawParts.push(token);
  }
  if (rawParts.length) result.raw = rawParts.join('');
  return result;
}

export function serializeMediaOptions(opts: IMediaOptions): string {
  const tokens: string[] = [];
  if (opts.noanswer) tokens.push('n');
  if (opts.skip) tokens.push('s');
  if (opts.p) tokens.push('p');
  if (opts.mixMode === 'say') tokens.push('say');
  if (opts.mixMode === 'mix') tokens.push('mix');
  if (opts.raw) tokens.push(opts.raw);
  return serializeOptions({ tokens });
}

export class MediaOptionsDto implements IMediaOptions {
  static fromString(input: string): MediaOptionsDto {
    const parsed = parseMediaOptions(input);
    const dto = new MediaOptionsDto();
    dto.noanswer = parsed.noanswer;
    dto.skip = parsed.skip;
    dto.p = parsed.p;
    dto.mixMode = parsed.mixMode;
    dto.raw = parsed.raw;
    return dto;
  }

  @IsOptional()
  @IsBoolean()
  noanswer?: boolean;

  @IsOptional()
  @IsBoolean()
  skip?: boolean;

  @IsOptional()
  @IsBoolean()
  p?: boolean;

  @IsOptional()
  @IsIn(MIX_MODES)
  mixMode?: MediaMixMode;

  @IsOptional()
  @IsString()
  @Matches(RAW_FLAGS)
  raw?: string;
}

function transformMediaOptions({ value }: { value: unknown }): unknown {
  if (typeof value === 'string') return MediaOptionsDto.fromString(value);
  return value;
}

class MediaParamsBase implements IMediaParams {
  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  file?: string;

  @IsOptional()
  @Transform(transformMediaOptions)
  @ValidateNested()
  @Type(() => MediaOptionsDto)
  options?: MediaOptionsDto | string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  langoverride?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  digittimeout?: number;
}

export class PlayPromptParamsDto extends MediaParamsBase implements IMediaParams {}

export class PlaybackParamsDto extends MediaParamsBase implements IMediaParams {}

export class Text2SpeechParamsDto implements IText2SpeechParams {
  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  text?: string;

  @IsOptional()
  @Transform(transformMediaOptions)
  @ValidateNested()
  @Type(() => MediaOptionsDto)
  options?: MediaOptionsDto | string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  langoverride?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  digittimeout?: number;
}

export class VoiceRobotParamsDto implements IVoiceRobotParams {
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  robot_uid?: number;
}

export class RecordParamsDto implements IRecordParams {
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  silence_timeout?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  max_timer?: number;

  @IsOptional()
  @Transform(transformMediaOptions)
  @ValidateNested()
  @Type(() => MediaOptionsDto)
  options?: MediaOptionsDto | string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  langoverride?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  digittimeout?: number;
}

export class ToFaxParamsDto implements IToFaxParams {
  @IsOptional()
  @IsString()
  @MinLength(1)
  email?: string;
}
