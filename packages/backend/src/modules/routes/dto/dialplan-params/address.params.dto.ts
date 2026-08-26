import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type {
  IToIvrParams,
  IToListParams,
  ITrunkCarouselItem,
} from '@krasterisk/shared';
import { coerceDestValueSource } from '@krasterisk/shared';
import { IsValueSourceConstraint, IsQueuePrioritySourceConstraint, ValueSourceDto } from './value-source.dto';

const SAFE_DIAL = /^[^(),?\[\]{}$\\";\n\r]*$/;
const PREPEND_DIGITS = /^[0-9+]*$/;

export class NumberManipulationDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  strip?: number;

  @IsOptional()
  @IsString()
  @Matches(PREPEND_DIGITS)
  prepend?: string;
}

const REWRITE_KINDS = ['eq', 'startsWith', 'endsWith', 'length', 'digitMask', 'regex'] as const;

export class DialRewriteConditionDto {
  @IsIn(REWRITE_KINDS)
  kind: (typeof REWRITE_KINDS)[number];

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(64)
  min?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(64)
  max?: number;
}

export class DialRewriteTransformDto {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z+*#]*$/)
  replaceAll?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32)
  stripStartCount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z+*#]*$/)
  stripStartText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32)
  stripEndCount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z+*#]*$/)
  stripEndText?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z+*#]*$/)
  replaceFind?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z+*#]*$/)
  replaceWith?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z+*#]*$/)
  prefix?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z+*#]*$/)
  postfix?: string;
}

export class DialRewriteRuleDto {
  @IsString()
  @MinLength(1)
  id: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DialRewriteConditionDto)
  conditions?: DialRewriteConditionDto[];

  @ValidateNested()
  @Type(() => DialRewriteTransformDto)
  transform: DialRewriteTransformDto;
}

export class DialTargetRewriteDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DialRewriteRuleDto)
  rules?: DialRewriteRuleDto[];

  @IsOptional()
  @IsIn(['passthrough', 'reject'])
  noMatch?: 'passthrough' | 'reject';
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => NumberManipulationDto)
  numberManipulation?: NumberManipulationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DialTargetRewriteDto)
  rewrite?: DialTargetRewriteDto;
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

  /** VIP skip of the queue tail — Set(QUEUE_PRIO=…) before Queue() (D-32). ValueSource or legacy number. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value == null) return undefined;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { source: 'fixed', value: String(Math.trunc(value)) };
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const n = parseInt(value, 10);
      if (!Number.isFinite(n)) return value;
      return { source: 'fixed', value: String(n) };
    }
    return value;
  })
  @Validate(IsQueuePrioritySourceConstraint)
  priority?: ValueSourceDto;

  /** 4th Queue() argument; prompt id only, never a path (T-12-13-02). */
  @IsOptional()
  @IsString()
  @Matches(/^(?!.*\.\.)[^\\/]*$/)
  announceoverride?: string;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => NumberManipulationDto)
  numberManipulation?: NumberManipulationDto;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => DialTargetRewriteDto)
  rewrite?: DialTargetRewriteDto;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => DialTargetRewriteDto)
  rewrite?: DialTargetRewriteDto;
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

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  timeout?: number;
}

export class ToTrunkParamsDto {
  @IsOptional()
  @IsIn(['single', 'carousel'])
  trunkMode?: 'single' | 'carousel';

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  trunk?: string;

  @IsOptional()
  @IsIn(['random_then_failover', 'sequential'])
  mode?: 'random_then_failover' | 'sequential';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrunkCarouselItemDto)
  trunks?: TrunkCarouselItemDto[];

  @IsOptional()
  @IsIn(['static', 'phonebook'])
  cid_mode?: 'static' | 'phonebook';

  @IsOptional()
  @IsString()
  @Matches(SAFE_DIAL)
  callerid?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  phonebook_uid?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return coerceDestValueSource(value);
  })
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

  @IsOptional()
  @ValidateNested()
  @Type(() => NumberManipulationDto)
  numberManipulation?: NumberManipulationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DialTargetRewriteDto)
  rewrite?: DialTargetRewriteDto;
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

