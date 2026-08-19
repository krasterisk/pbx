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

export const ActionTypesList = [
  'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
  'toivr', 'toroute', 'playprompt', 'playback',
  'setclid_custom', 'setclid_list',
  'sendmail', 'sendmailpeer', 'telegram',
  'notify', 'callerid', 'trunk_carousel',
  'voicemail', 'text2speech', 'voicerobot', 'asr', 'keywords',
  'webhook', 'confbridge', 'cmd', 'tofax',
  'label', 'busy', 'hangup', 'congestion',
];

const ValidDialstatuses = [
  '', 'CHANUNAVAIL', 'CONGESTION', 'BUSY', 'NOANSWER', 'ANSWER',
  'CANCEL', 'DONTCALL', 'TORTURE', 'INVALIDARGS',
];

const MatchModesList = ['on_match', 'on_no_match'];

const BehaviorTypesList = [
  'set_name', 'set_number', 'drop',
  'blacklist', 'whitelist', // legacy aliases accepted, normalized on save
  'redirect', 'vars_only', 'custom',
];

const toQueueParamErrors = new WeakMap<object, ValidationError[]>();

@ValidatorConstraint({ name: 'isTypedActionParams', async: false })
class IsTypedActionParamsConstraint implements ValidatorConstraintInterface {
  validate(params: unknown, args: ValidationArguments): boolean {
    if (!params || typeof params !== 'object' || Array.isArray(params)) return false;
    const action = args.object as RouteActionDto;
    if (action.type !== 'toqueue') return true;
    const dto = plainToInstance(ToQueueParamsDto, params);
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

@ValidatorConstraint({ name: 'isDialstatusOrArray', async: false })
class IsDialstatusOrArrayConstraint implements ValidatorConstraintInterface {
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

export class RouteActionConditionDto {
  @IsOptional()
  @Validate(IsDialstatusOrArrayConstraint)
  dialstatus?: string | string[];

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
export class RoutePhonebookBindingDto {
  @IsNumber()
  phonebook_uid: number;

  @IsNumber()
  position: number;

  @IsIn(MatchModesList)
  match_mode: string;

  @IsIn(BehaviorTypesList)
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutePhonebookBindingDto)
  bindings?: RoutePhonebookBindingDto[];
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
  @Type(() => RoutePhonebookBindingDto)
  bindings?: RoutePhonebookBindingDto[];
}
