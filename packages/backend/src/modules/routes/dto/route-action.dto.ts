import { IsString, IsObject, IsOptional, ValidateNested, IsIn, IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

const ActionTypesList = [
  'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
  'toivr', 'toroute', 'playprompt', 'playback',
  'setclid_custom', 'setclid_list',
  'sendmail', 'sendmailpeer', 'telegram',
  'voicemail', 'text2speech', 'voicerobot', 'asr', 'keywords',
  'webhook', 'confbridge', 'cmd', 'tofax',
  'label', 'busy', 'hangup'
];

const ValidDialstatuses = [
  '', 'CHANUNAVAIL', 'CONGESTION', 'BUSY', 'NOANSWER', 'ANSWER',
  'CANCEL', 'DONTCALL', 'TORTURE', 'INVALIDARGS',
];

export class RouteActionConditionDto {
  @IsOptional()
  @IsIn(ValidDialstatuses)
  dialstatus?: string;

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
}
