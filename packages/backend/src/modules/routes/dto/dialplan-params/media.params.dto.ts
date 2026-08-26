import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type {
  IIvrPhraseTtsSettings,
  IMediaOptions,
  IMediaParams,
  IPlaybackParams,
  IRecordParams,
  IText2SpeechParams,
  IToFaxParams,
  IVoiceRobotParams,
  MediaMixMode,
  PlaybackMode,
} from '@krasterisk/shared';
import { PLAYBACK_MODES } from '@krasterisk/shared';
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
}

export class PlayPromptParamsDto extends MediaParamsBase implements IMediaParams {}

const SAFE_PROMPT_FILE = /^[A-Za-z0-9._-]*$/;
const LANG_OVERRIDE = /^[A-Za-z]{1,8}(?:-[A-Za-z]{1,8})?$/;
const MAX_DIGIT_TIMEOUT = 60;

function optionsHasP(options?: MediaOptionsDto | string): boolean {
  if (!options) return false;
  if (typeof options === 'string') return parseMediaOptions(options).p === true;
  return options.p === true;
}

@ValidatorConstraint({ name: 'isPlaybackFiles', async: false })
class IsPlaybackFilesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === '') return true;
    const list = Array.isArray(value) ? value : [value];
    return list.every((item) => typeof item === 'string' && SAFE_PROMPT_FILE.test(item));
  }

  defaultMessage(): string {
    return 'files must be prompt identifiers, not a path';
  }
}

@ValidatorConstraint({ name: 'playbackOptionApplicability', async: false })
class PlaybackOptionApplicabilityConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as PlaybackParamsDto;
    if (!obj.mode) return true;
    if (obj.mode !== 'control' && optionsHasP(obj.options)) return false;
    if (obj.mode !== 'menu' && obj.langoverride) return false;
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const obj = args.object as PlaybackParamsDto;
    if (obj.mode !== 'control' && optionsHasP(obj.options)) {
      return 'option p is only valid in control playback mode';
    }
    return 'langoverride is only valid in menu playback mode';
  }
}

export class PlaybackParamsDto extends MediaParamsBase implements IPlaybackParams {
  @IsOptional()
  @IsIn(PLAYBACK_MODES)
  @Validate(PlaybackOptionApplicabilityConstraint)
  mode?: PlaybackMode;

  @IsOptional()
  @Validate(IsPlaybackFilesConstraint)
  files?: string | string[];

  @IsOptional()
  @IsString()
  @MaxLength(8)
  @Matches(LANG_OVERRIDE)
  langoverride?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  @Max(MAX_DIGIT_TIMEOUT)
  digittimeout?: number;
}

/** Same override contract as IVR phrases and synthesized prompts. */
export class TtsSettingsDto implements IIvrPhraseTtsSettings {
  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  voice?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  language_code?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  speed?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  speaking_rate?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  role?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  pitch_shift?: string;
}

export class Text2SpeechParamsDto implements IText2SpeechParams {
  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  text?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value == null) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  })
  @IsInt()
  @Min(1)
  engine?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TtsSettingsDto)
  settings?: TtsSettingsDto;

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
