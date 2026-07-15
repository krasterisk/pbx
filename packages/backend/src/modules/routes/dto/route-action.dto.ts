import {
  IsString,
  IsObject,
  IsOptional,
  ValidateNested,
  IsIn,
  IsArray,
  IsNumber,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';

const ActionTypesList = [
  'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
  'toivr', 'toroute', 'playprompt', 'playback',
  'setclid_custom', 'setclid_list',
  'sendmail', 'sendmailpeer', 'telegram',
  'notify', 'callerid', 'trunk_carousel',
  'voicemail', 'text2speech', 'voicerobot', 'asr', 'keywords',
  'webhook', 'confbridge', 'cmd', 'tofax',
  'label', 'busy', 'hangup'
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

  @IsObject()
  params: Record<string, any>;

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
