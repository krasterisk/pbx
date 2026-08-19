import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type {
  IToIvrParams,
  IToListParams,
  ITrunkCarouselActionParams,
  ITrunkCarouselItem,
} from '@krasterisk/shared';
import { IsValueSourceConstraint, ValueSourceDto } from './value-source.dto';

const SAFE_DIAL = /^[^(),?\[\]{}$\\";\n\r]*$/;

/**
 * ConfBridge params as the generator reads them today (`room` / `options`).
 * Not in this phase (D-41): profiles, PIN, admin-marked, recording, DTMF menu,
 * tenant-scoped room names. Room stays without a tenant suffix (T-12-03-05).
 */
export class ConfBridgeParamsDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => ValueSourceDto)
  room: ValueSourceDto;

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  options?: string;
}

export class ToExtenParamsDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => ValueSourceDto)
  target: ValueSourceDto;

  /** Read by the generator; selects transport in pjsipDialTarget. Revived, not removed (D-39). */
  @IsOptional()
  @IsBoolean()
  webrtc?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  timeout?: number;

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  options?: string;

  @IsOptional()
  @IsString()
  exten?: string;

  @IsOptional()
  @IsBoolean()
  useExten?: boolean;
}

export class ToQueueParamsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ValueSourceDto)
  @Validate(IsValueSourceConstraint)
  target?: ValueSourceDto;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  timeout?: number;

  @IsOptional()
  @IsString()
  options?: string;

  /** @deprecated Wave 0 field — accepted when `target` is absent */
  @IsOptional()
  @IsString()
  queue?: string;
}

export class ToGroupParamsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ValueSourceDto)
  target?: ValueSourceDto;

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  group?: string;
}

export class ToListParamsDto implements IToListParams {
  @IsOptional()
  @IsString()
  @Matches(/^[^()?\[\]{}$\\";\n\r]*$/)
  numbers?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  timeout?: number;

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  options?: string;
}

export class ToIvrParamsDto implements IToIvrParams {
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  ivr_uid?: number;
}

export class ToRouteParamsDto {
  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  context?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ValueSourceDto)
  extension?: ValueSourceDto;
}

export class ToTrunkParamsDto {
  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  trunk?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ValueSourceDto)
  dest?: ValueSourceDto;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  timeout?: number;

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  options?: string;
}

export class VoicemailParamsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ValueSourceDto)
  target?: ValueSourceDto;

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  exten?: string;
}

class TrunkCarouselItemDto implements ITrunkCarouselItem {
  @IsString()
  @MinLength(1)
  @Matches(SAFE_DIAL)
  trunk: string;

  @IsIn(['static', 'phonebook'])
  cid_mode: 'static' | 'phonebook';

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  callerid?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  phonebook_uid?: number;
}

export class TrunkCarouselParamsDto implements ITrunkCarouselActionParams {
  @IsIn(['random_then_failover'])
  mode: 'random_then_failover';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrunkCarouselItemDto)
  trunks: TrunkCarouselItemDto[];

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  timeout?: number;

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  options?: string;
}
