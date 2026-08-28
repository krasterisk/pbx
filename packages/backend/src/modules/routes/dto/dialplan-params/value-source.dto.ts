import {
  IsIn,
  IsInt,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';

export const CALL_VALUE_SOURCES = [
  'fixed',
  'route_pattern',
  'variable',
  'original_caller',
  'current_caller',
] as const;
export const VALUE_SOURCES = [...CALL_VALUE_SOURCES, 'directory'] as const;
export const PRIORITY_SOURCES = ['fixed', 'variable', 'directory'] as const;
const ON_MISSING = ['keep', 'empty', 'skip'] as const;

function isCallValueSource(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const src = value as Record<string, unknown>;
  if (!CALL_VALUE_SOURCES.includes(src.source as (typeof CALL_VALUE_SOURCES)[number])) {
    return false;
  }
  if (src.source === 'fixed') {
    return typeof src.value === 'string' && src.value.trim().length > 0;
  }
  if (src.source === 'variable') {
    return typeof src.name === 'string' && src.name.trim().length > 0;
  }
  return true;
}

function isDirectorySource(src: Record<string, unknown>): boolean {
  return (
    Number.isInteger(src.directoryUid) &&
    Number(src.directoryUid) > 0 &&
    Number.isInteger(src.valueFieldUid) &&
    Number(src.valueFieldUid) > 0 &&
    ON_MISSING.includes(src.onMissing as (typeof ON_MISSING)[number]) &&
    isCallValueSource(src.keySource)
  );
}

@ValidatorConstraint({ name: 'isValueSource', async: false })
export class IsValueSourceConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const src = value as Record<string, unknown>;
    if (!VALUE_SOURCES.includes(src.source as (typeof VALUE_SOURCES)[number])) return false;
    if (src.source === 'fixed') {
      return typeof src.value === 'string' && src.value.trim().length > 0;
    }
    if (src.source === 'variable') {
      return typeof src.name === 'string' && src.name.trim().length > 0;
    }
    if (src.source === 'directory') {
      return isDirectorySource(src);
    }
    return true;
  }

  defaultMessage(): string {
    return 'target.source must be fixed, route_pattern, variable, original_caller, current_caller, or directory; directory requires directoryUid, keySource, valueFieldUid, and onMissing';
  }
}

/** Queue priority ValueSource: no route_pattern; fixed must be integer 0..20. */
@ValidatorConstraint({ name: 'isQueuePrioritySource', async: false })
export class IsQueuePrioritySourceConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const src = value as Record<string, unknown>;
    if (!PRIORITY_SOURCES.includes(src.source as (typeof PRIORITY_SOURCES)[number])) return false;
    if (src.source === 'fixed') {
      if (typeof src.value !== 'string' || !src.value.trim()) return false;
      const n = Number(src.value);
      return Number.isInteger(n) && n >= 0 && n <= 20;
    }
    if (src.source === 'variable') {
      return typeof src.name === 'string' && src.name.trim().length > 0;
    }
    return isDirectorySource(src);
  }

  defaultMessage(): string {
    return 'priority must be fixed (0-20), variable, or directory';
  }
}

export class CallValueSourceDto {
  @IsIn(CALL_VALUE_SOURCES)
  source: (typeof CALL_VALUE_SOURCES)[number];

  @ValidateIf((o) => o.source === 'fixed')
  @IsString()
  @MinLength(1)
  value?: string;

  @ValidateIf((o) => o.source === 'variable')
  @IsString()
  @MinLength(1)
  name?: string;
}

export class ValueSourceDto {
  @IsIn(VALUE_SOURCES)
  source: (typeof VALUE_SOURCES)[number];

  @ValidateIf((o) => o.source === 'fixed')
  @IsString()
  @MinLength(1)
  value?: string;

  @ValidateIf((o) => o.source === 'variable')
  @IsString()
  @MinLength(1)
  name?: string;

  @ValidateIf((o) => o.source === 'directory')
  @IsInt()
  @Min(1)
  directoryUid?: number;

  @ValidateIf((o) => o.source === 'directory')
  @ValidateNested()
  @Type(() => CallValueSourceDto)
  keySource?: CallValueSourceDto;

  @ValidateIf((o) => o.source === 'directory')
  @IsInt()
  @Min(1)
  valueFieldUid?: number;

  @ValidateIf((o) => o.source === 'directory')
  @IsIn(ON_MISSING)
  onMissing?: (typeof ON_MISSING)[number];
}
