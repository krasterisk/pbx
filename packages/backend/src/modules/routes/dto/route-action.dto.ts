import {
  IsString,
  IsObject,
  IsOptional,
  ValidateNested,
  IsIn,
  IsArray,
  IsNumber,
  ArrayMaxSize,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidationError,
  validateSync,
} from 'class-validator';
import { plainToInstance, Type } from 'class-transformer';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ToQueueParamsDto } from './dialplan-params/toqueue.params.dto';
import { DirectoryLookupParamsDto } from './dialplan-params/directory-lookup.params.dto';
import { CallValueSourceDto } from './dialplan-params/value-source.dto';
import { RouteConditionDto } from './route-condition.dto';

export const ActionTypesList = [
  'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
  'toivr', 'toroute', 'playback',
  'notify', 'callerid',
  'voicemail', 'text2speech', 'voicerobot',
  'webhook', 'confbridge', 'cmd',
  'label', 'goto', 'schedule',
  'http_request', 'collect_input',
  'hangup', 'directory_lookup',
];

const MatchModesList = ['on_match', 'on_no_match'];

const BehaviorTypesList = [
  'set_name', 'set_number', 'drop',
  'redirect', 'map_fields', 'custom',
];

function directoryBehaviorParamsValid(
  behaviorType: string,
  params?: Record<string, any> | null,
): boolean {
  const p = params || {};
  if (behaviorType === 'set_name' || behaviorType === 'set_number') {
    if (typeof p.fixed === 'string' && p.fixed.length > 0) return true;
    return Number.isInteger(p.fieldUid) && p.fieldUid > 0;
  }
  if (behaviorType === 'redirect') {
    if (typeof p.fixedExten === 'string' && p.fixedExten.length > 0) return true;
    return Number.isInteger(p.fieldUid) && p.fieldUid > 0;
  }
  if (behaviorType === 'map_fields') {
    return Array.isArray(p.mappings)
      && p.mappings.length > 0
      && p.mappings.every((m: { fieldUid?: number }) => Number.isInteger(m?.fieldUid) && (m.fieldUid as number) > 0);
  }
  return true;
}

@ValidatorConstraint({ name: 'isDirectoryBindingBehavior', async: false })
class IsDirectoryBindingBehaviorConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const binding = args.object as RouteDirectoryBindingDto;
    return directoryBehaviorParamsValid(binding.behavior_type, binding.behavior_params);
  }

  defaultMessage(): string {
    return 'field-consuming behavior requires fieldUid (or fixed/fixedExten); map_fields requires mappings';
  }
}

const toQueueParamErrors = new WeakMap<object, ValidationError[]>();

@ValidatorConstraint({ name: 'isTypedActionParams', async: false })
class IsTypedActionParamsConstraint implements ValidatorConstraintInterface {
  validate(params: unknown, args: ValidationArguments): boolean {
    if (!params || typeof params !== 'object' || Array.isArray(params)) return false;
    const action = args.object as RouteActionDto;
    const Dto = action.type === 'toqueue'
      ? ToQueueParamsDto
      : action.type === 'directory_lookup'
        ? DirectoryLookupParamsDto
        : null;
    if (!Dto) return true;
    const dto = plainToInstance(Dto, params);
    const errors = validateSync(dto);
    toQueueParamErrors.set(action, errors);
    return errors.length === 0;
  }

  defaultMessage(args: ValidationArguments): string {
    const nested = toQueueParamErrors.get(args.object as object) ?? [];
    if (nested.length) {
      return nested
        .flatMap((err) => Object.values(err.constraints ?? {}))
        .filter(Boolean)
        .join('; ') || 'params are invalid';
    }
    return 'params must be an object';
  }
}

export function formatRouteValidationErrors(
  errors: ValidationError[],
): Array<{ actionId: string | null; path: string; message: string }> {
  const out: Array<{ actionId: string | null; path: string; message: string }> = [];
  const walk = (list: ValidationError[], prefix: string, inheritedId: string | null) => {
    for (const err of list) {
      const path = prefix ? `${prefix}.${err.property}` : err.property;
      const target = err.target as { id?: string } | undefined;
      const actionId = target?.id || inheritedId;
      if (err.constraints) {
        for (const message of Object.values(err.constraints)) {
          out.push({ actionId: actionId || null, path, message });
        }
      }
      if (err.children?.length) {
        walk(err.children, path, actionId || inheritedId);
      }
    }
  };
  walk(errors, '', null);
  return out;
}

export function createRoutesValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    exceptionFactory: (errors) =>
      new BadRequestException({ errors: formatRouteValidationErrors(errors) }),
  });
}

export class RouteActionConditionDto extends RouteConditionDto {
  @IsOptional()
  @IsNumber()
  time_group_uid?: number;

  @IsOptional()
  @IsString()
  calendar?: string;
}

export class RouteActionDto {
  @IsString()
  id: string;

  @IsIn(ActionTypesList)
  type: string;

  @Validate(IsTypedActionParamsConstraint)
  params: object;

  @IsObject()
  @ValidateNested()
  @Type(() => RouteActionConditionDto)
  condition: RouteActionConditionDto;
}

// Bindings sent by clients omit uid/route_uid — replace-all strategy assigns
// route_uid and position (array index) server-side (RoutesService.replaceBindings).
export class RouteDirectoryBindingDto {
  @IsNumber()
  directory_uid: number;

  @IsOptional()
  @IsNumber()
  position?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => CallValueSourceDto)
  key_source: CallValueSourceDto;

  @IsIn(MatchModesList)
  match_mode: string;

  @IsIn(BehaviorTypesList)
  @Validate(IsDirectoryBindingBehaviorConstraint)
  behavior_type: string;

  @IsOptional()
  @IsObject()
  behavior_params?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RouteActionDto)
  actions?: RouteActionDto[];
}

export class CreateRouteDto {
  @IsNumber()
  context_uid: number;

  @IsString()
  name: string;

  @IsArray()
  @IsString({ each: true })
  extensions: string[];

  @IsOptional()
  @IsNumber()
  active?: number;

  @IsOptional()
  @IsObject()
  options?: Record<string, any>;

  @IsOptional()
  @IsObject()
  webhooks?: Record<string, any>;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RouteActionDto)
  actions: RouteActionDto[];

  @IsOptional()
  @IsString()
  raw_dialplan?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteDirectoryBindingDto)
  bindings?: RouteDirectoryBindingDto[];
}

export class UpdateRouteDto {
  @IsOptional()
  @IsNumber()
  context_uid?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extensions?: string[];

  @IsOptional()
  @IsNumber()
  active?: number;

  @IsOptional()
  @IsObject()
  options?: Record<string, any>;

  @IsOptional()
  @IsObject()
  webhooks?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RouteActionDto)
  actions?: RouteActionDto[];

  @IsOptional()
  @IsString()
  raw_dialplan?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteDirectoryBindingDto)
  bindings?: RouteDirectoryBindingDto[];
}
