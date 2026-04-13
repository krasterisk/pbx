import { IsString, IsObject, IsOptional, ValidateNested, IsIn } from 'class-validator';
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

export class RouteActionConditionDto {
  @IsOptional()
  @IsString()
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
