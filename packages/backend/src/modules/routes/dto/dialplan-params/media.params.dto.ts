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

const MIX_MODES = ['say', 'mix'] as const;
const SAFE_TEXT = /^[^\n\r;]*$/;
const RAW_FLAGS = /^[A-Za-z0-9().,:_-]*$/;

function isWordChar(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z]/.test(ch);
}

export function parseMediaOptions(input: string): IMediaOptions {
  let i = 0;
  const result: IMediaOptions = {};
  const rawParts: string[] = [];
  while (i < input.length) {
    if (input.startsWith('say', i) && !isWordChar(input[i + 3])) {
      result.mixMode = 'say';
      i += 3;
      continue;
    }
    if (input.startsWith('mix', i) && !isWordChar(input[i + 3])) {
      result.mixMode = 'mix';
      i += 3;
      continue;
    }
    const ch = input[i];
    if (ch === 'n') {
      result.noanswer = true;
      i += 1;
      continue;
    }
    if (ch === 's') {
      result.skip = true;
      i += 1;
      continue;
    }
    if (ch === 'p') {
      result.p = true;
      i += 1;
      continue;
    }
    let j = i + 1;
    if (input[j] === '(') {
      let depth = 1;
      j += 1;
      while (j < input.length && depth > 0) {
        if (input[j] === '(') depth += 1;
        else if (input[j] === ')') depth -= 1;
        j += 1;
      }
    }
    rawParts.push(input.slice(i, j));
    i = j;
  }
  if (rawParts.length) result.raw = rawParts.join('');
  return result;
}

export function serializeMediaOptions(opts: IMediaOptions): string {
  let out = '';
  if (opts.noanswer) out += 'n';
  if (opts.skip) out += 's';
  if (opts.p) out += 'p';
  if (opts.mixMode === 'say') out += 'say';
  if (opts.mixMode === 'mix') out += 'mix';
  if (opts.raw) out += opts.raw;
  return out;
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
