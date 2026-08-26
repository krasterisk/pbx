import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsArray,
  IsBoolean,
  Matches,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { parseOptions, serializeOptions } from '../../../shared/utils/dialplan-options.util';

/** 2–8 digits — same envelope as queue/internal numbers (T-12-14-02) */
export const CALL_GROUP_EXTEN_PATTERN = /^\d{2,8}$/;

/** Prompt / MOH class identifiers — no path separators (T-12-15-03) */
export const CALL_GROUP_MEDIA_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Single DTMF key for external answer confirmation */
export const CALL_GROUP_CONFIRM_DIGIT_PATTERN = /^[0-9*#]$/;

function optionsBalanced(input: string): boolean {
  let depth = 0;
  for (const ch of input) {
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

@ValidatorConstraint({ name: 'isDialOptions', async: false })
export class IsDialOptionsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    if (!optionsBalanced(value)) return false;
    if (/[;$\n\r\\]/.test(value)) return false;
    try {
      return serializeOptions(parseOptions(value)) === value;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'dialOptions must be a balanced Dial() options string';
  }
}

export class CallGroupMemberDto {
  @IsIn(['internal', 'external'])
  member_type: 'internal' | 'external';

  @IsString()
  value: string;

  @IsNumber()
  position: number;

  @IsOptional()
  @IsNumber()
  ring_time?: number;
}

export class CreateCallGroupDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(CALL_GROUP_EXTEN_PATTERN, { message: 'exten must be 2-8 digits' })
  exten: string;

  @IsIn(['ringall', 'hunt', 'memoryhunt', 'random'])
  strategy: 'ringall' | 'hunt' | 'memoryhunt' | 'random';

  @IsOptional()
  @IsNumber()
  ring_time?: number;

  @IsOptional()
  @IsString()
  external_context?: string;

  @IsOptional()
  @IsString()
  cid_prefix?: string;

  @IsOptional()
  @IsBoolean()
  confirmExternal?: boolean;

  @IsOptional()
  @IsString()
  @Matches(CALL_GROUP_CONFIRM_DIGIT_PATTERN, { message: 'confirmDigit must be a single DTMF key (0-9, *, #)' })
  confirmDigit?: string;

  @IsOptional()
  @IsBoolean()
  skipBusy?: boolean;

  @IsOptional()
  @IsString()
  @Matches(CALL_GROUP_MEDIA_ID_PATTERN, { message: 'greetingPrompt must be a media identifier' })
  greetingPrompt?: string;

  @IsOptional()
  @IsString()
  @Matches(CALL_GROUP_MEDIA_ID_PATTERN, { message: 'mohClass must be a media identifier' })
  mohClass?: string;

  @IsOptional()
  @IsBoolean()
  useMohInsteadOfRingback?: boolean;

  @IsOptional()
  @IsString()
  @Validate(IsDialOptionsConstraint)
  dialOptions?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallGroupMemberDto)
  members?: CallGroupMemberDto[];
}

export class UpdateCallGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(CALL_GROUP_EXTEN_PATTERN, { message: 'exten must be 2-8 digits' })
  exten?: string;

  @IsOptional()
  @IsIn(['ringall', 'hunt', 'memoryhunt', 'random'])
  strategy?: 'ringall' | 'hunt' | 'memoryhunt' | 'random';

  @IsOptional()
  @IsNumber()
  ring_time?: number;

  @IsOptional()
  @IsString()
  external_context?: string;

  @IsOptional()
  @IsString()
  cid_prefix?: string;

  @IsOptional()
  @IsBoolean()
  confirmExternal?: boolean;

  @IsOptional()
  @IsString()
  @Matches(CALL_GROUP_CONFIRM_DIGIT_PATTERN, { message: 'confirmDigit must be a single DTMF key (0-9, *, #)' })
  confirmDigit?: string;

  @IsOptional()
  @IsBoolean()
  skipBusy?: boolean;

  @IsOptional()
  @IsString()
  @Matches(CALL_GROUP_MEDIA_ID_PATTERN, { message: 'greetingPrompt must be a media identifier' })
  greetingPrompt?: string;

  @IsOptional()
  @IsString()
  @Matches(CALL_GROUP_MEDIA_ID_PATTERN, { message: 'mohClass must be a media identifier' })
  mohClass?: string;

  @IsOptional()
  @IsBoolean()
  useMohInsteadOfRingback?: boolean;

  @IsOptional()
  @IsString()
  @Validate(IsDialOptionsConstraint)
  dialOptions?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallGroupMemberDto)
  members?: CallGroupMemberDto[];
}
