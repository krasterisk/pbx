import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Transform } from 'class-transformer';

const VALUE_SOURCES = ['fixed', 'route_pattern', 'variable', 'phonebook'] as const;

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
      return Number.isInteger(src.phonebookUid);
    }
    return true;
  }

  defaultMessage(): string {
    return 'target.source must be fixed, route_pattern, variable, or phonebook; fixed requires a non-empty value';
  }
}

export class ToQueueParamsDto {
  @IsOptional()
  @Validate(IsValueSourceConstraint)
  target?: Record<string, unknown>;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
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
