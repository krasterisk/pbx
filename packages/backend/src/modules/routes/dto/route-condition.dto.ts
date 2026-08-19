import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidationError,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CONDITION_DEVICE_RE,
  CONDITION_OPS,
  CONDITION_SOURCES,
  CONDITION_VAR_NAME_RE,
  DIALSTATUS_VALUES,
  DEVICE_STATE_VALUES,
  QUEUESTATUS_VALUES,
  type ConditionSourceKind,
} from '@krasterisk/shared';

const ValidDialstatuses: readonly string[] = ['', ...DIALSTATUS_VALUES];

const sourceErrors = new WeakMap<object, ValidationError[]>();

@ValidatorConstraint({ name: 'isDialstatusOrArray', async: false })
export class IsDialstatusOrArrayConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return ValidDialstatuses.includes(value);
    if (Array.isArray(value)) {
      return value.every((item) => typeof item === 'string' && ValidDialstatuses.includes(item));
    }
    return false;
  }

  defaultMessage(): string {
    return 'dialstatus must be a valid status or array of valid statuses';
  }
}

class DialstatusSourceDto {
  @IsIn(['dialstatus'])
  source: 'dialstatus';

  @IsOptional()
  @Validate(IsDialstatusOrArrayConstraint)
  values?: string | string[];

  @IsOptional()
  @Validate(IsDialstatusOrArrayConstraint)
  dialstatus?: string | string[];
}

class QueuestatusSourceDto {
  @IsIn(['queuestatus'])
  source: 'queuestatus';

  @IsArray()
  @IsIn([...QUEUESTATUS_VALUES], { each: true })
  values: string[];
}

class DeviceStateSourceDto {
  @IsIn(['device_state'])
  source: 'device_state';

  @Matches(CONDITION_DEVICE_RE)
  device: string;

  @IsArray()
  @IsIn([...DEVICE_STATE_VALUES], { each: true })
  values: string[];
}

class VariableSourceDto {
  @IsIn(['variable'])
  source: 'variable';

  @Matches(CONDITION_VAR_NAME_RE)
  name: string;

  @IsIn([...CONDITION_OPS])
  op: string;

  @IsString()
  value: string;
}

class HttpResultSourceDto {
  @IsIn(['http_result'])
  source: 'http_result';

  @IsIn([...CONDITION_OPS])
  op: string;

  @IsString()
  value: string;
}

type SourceDtoClass = new (...args: any[]) => object;

/** ACTION_PARAM_DTO-style registry: one DTO per ConditionSource (12-03 form). */
export const CONDITION_SOURCE_DTO: Record<ConditionSourceKind, SourceDtoClass> = {
  dialstatus: DialstatusSourceDto,
  queuestatus: QueuestatusSourceDto,
  device_state: DeviceStateSourceDto,
  variable: VariableSourceDto,
  http_result: HttpResultSourceDto,
};

@ValidatorConstraint({ name: 'isTypedConditionSource', async: false })
class IsTypedConditionSourceConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as RouteConditionDto;
    if (!obj.source) return true;
    if (!Object.prototype.hasOwnProperty.call(CONDITION_SOURCE_DTO, obj.source)) {
      return false;
    }
    const DtoClass = CONDITION_SOURCE_DTO[obj.source];
    const dto = plainToInstance(DtoClass, obj);
    const errors = validateSync(dto);
    sourceErrors.set(obj, errors);
    return errors.length === 0;
  }

  defaultMessage(args: ValidationArguments): string {
    const nested = sourceErrors.get(args.object as object) ?? [];
    if (nested.length) {
      return nested
        .flatMap((err) => Object.values(err.constraints ?? {}))
        .filter(Boolean)
        .join('; ') || 'condition source is invalid';
    }
    return 'condition source is invalid';
  }
}

export class RouteConditionDto {
  @IsOptional()
  @IsIn([...CONDITION_SOURCES])
  @Validate(IsTypedConditionSourceConstraint)
  source?: ConditionSourceKind;

  @IsOptional()
  @ValidateIf((o: RouteConditionDto) => !o.source || o.source === 'dialstatus')
  @Validate(IsDialstatusOrArrayConstraint)
  values?: string | string[];

  @IsOptional()
  @ValidateIf((o: RouteConditionDto) => !o.source || o.source === 'dialstatus')
  @Validate(IsDialstatusOrArrayConstraint)
  dialstatus?: string | string[];

  @IsOptional()
  @IsString()
  device?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  op?: string;

  @IsOptional()
  @IsString()
  value?: string;
}
