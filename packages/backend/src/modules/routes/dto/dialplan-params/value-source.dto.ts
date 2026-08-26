import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
const VALUE_SOURCES = ['fixed', 'route_pattern', 'variable', 'phonebook'] as const;
const PRIORITY_SOURCES = ['fixed', 'variable', 'phonebook'] as const;

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
    if (src.source === 'phonebook') {
      return (
        Number.isInteger(src.phonebookUid) &&
        Number(src.phonebookUid) > 0 &&
        typeof src.varKey === 'string' &&
        src.varKey.trim().length > 0
      );
    }
    return true;
  }

  defaultMessage(): string {
    return 'target.source must be fixed, route_pattern, variable, or phonebook; phonebook requires phonebookUid and varKey';
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
    return (
      Number.isInteger(src.phonebookUid) &&
      Number(src.phonebookUid) > 0 &&
      typeof src.varKey === 'string' &&
      src.varKey.trim().length > 0
    );
  }

  defaultMessage(): string {
    return 'priority must be fixed (0-20), variable, or phonebook';
  }
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

  @ValidateIf((o) => o.source === 'phonebook')
  @IsInt()
  @Min(1)
  phonebookUid?: number;

  @ValidateIf((o) => o.source === 'phonebook')
  @IsString()
  @MinLength(1)
  varKey?: string;
}

export { VALUE_SOURCES, PRIORITY_SOURCES };
