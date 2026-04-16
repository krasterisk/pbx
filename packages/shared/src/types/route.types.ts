export type ActionType =
  | 'totrunk' | 'toexten' | 'toqueue' | 'togroup' | 'tolist'
  | 'toivr' | 'toroute' | 'playprompt' | 'playback'
  | 'setclid_custom' | 'setclid_list'
  | 'sendmail' | 'sendmailpeer' | 'telegram'
  | 'voicemail' | 'text2speech' | 'voicerobot' | 'asr' | 'keywords'
  | 'webhook' | 'confbridge' | 'cmd' | 'tofax'
  | 'label' | 'busy' | 'hangup';

/** Asterisk DIALSTATUS values — used as condition whitelist */
export type DialStatus =
  | 'CHANUNAVAIL' | 'CONGESTION' | 'BUSY' | 'NOANSWER' | 'ANSWER'
  | 'CANCEL' | 'DONTCALL' | 'TORTURE' | 'INVALIDARGS';

/** Action category for UI grouping in <optgroup> */
export type ActionCategory = 'telephony' | 'media' | 'notification' | 'system';

export interface IRouteActionCondition {
  dialstatus?: DialStatus | '';
  calendar?: string;
}


interface BaseRouteAction {
  id: string;
  condition: IRouteActionCondition;
}

export interface ITrunkActionParams {
  trunk?: string;
  dest?: string;
  timeout?: number | string;
  options?: string;
}

export interface IExtenActionParams {
  exten?: string;
  timeout?: number | string;
  options?: string;
}

export interface IQueueActionParams {
  queue?: string;
  timeout?: number | string;
  options?: string;
}

export interface IGroupActionParams {
  group?: string;
}

export interface IListActionParams {
  numbers?: string;
  timeout?: number | string;
  options?: string;
}

export interface IIvrActionParams {
  ivr_uid?: string | number;
}

export interface IRouteActionParams {
  context?: string;
  extension?: string;
}

export interface IPromptActionParams {
  file?: string;
}

export interface ISetClidCustomActionParams {
  callerid?: string;
}

export interface ISetClidListActionParams {
  list_uid?: string | number;
}

export interface ISendMailActionParams {
  email?: string;
  text?: string;
}

export interface ISendMailPeerActionParams {
  exten?: string;
  text?: string;
}

export interface ITelegramActionParams {
  chat_id?: string;
  text?: string;
}

export interface IVoicemailActionParams {
  exten?: string;
}

export interface IText2SpeechActionParams {
  text?: string;
}

export interface IVoiceRobotActionParams {
  robot_uid?: number;
}

export interface IRecordActionParams {
  silence_timeout?: number | string;
  max_timer?: number | string;
}

export interface IWebhookActionParams {
  url?: string;
}

export interface IConfbridgeActionParams {
  room?: string;
}

export interface ICmdActionParams {
  command?: string;
}

export interface IToFaxActionParams {
  email?: string;
}

export interface ILabelActionParams {
  label_name?: string;
}

export interface IBusyActionParams {
  timeout?: number | string;
}

export type DialplanAction = BaseRouteAction & (
  | { type: 'totrunk'; params: ITrunkActionParams }
  | { type: 'toexten'; params: IExtenActionParams }
  | { type: 'toqueue'; params: IQueueActionParams }
  | { type: 'togroup'; params: IGroupActionParams }
  | { type: 'tolist'; params: IListActionParams }
  | { type: 'toivr'; params: IIvrActionParams }
  | { type: 'toroute'; params: IRouteActionParams }
  | { type: 'playprompt'; params: IPromptActionParams }
  | { type: 'playback'; params: IPromptActionParams }
  | { type: 'setclid_custom'; params: ISetClidCustomActionParams }
  | { type: 'setclid_list'; params: ISetClidListActionParams }
  | { type: 'sendmail'; params: ISendMailActionParams }
  | { type: 'sendmailpeer'; params: ISendMailPeerActionParams }
  | { type: 'telegram'; params: ITelegramActionParams }
  | { type: 'voicemail'; params: IVoicemailActionParams }
  | { type: 'text2speech'; params: IText2SpeechActionParams }
  | { type: 'voicerobot'; params: IVoiceRobotActionParams }
  | { type: 'asr'; params: IRecordActionParams }
  | { type: 'keywords'; params: IRecordActionParams }
  | { type: 'webhook'; params: IWebhookActionParams }
  | { type: 'confbridge'; params: IConfbridgeActionParams }
  | { type: 'cmd'; params: ICmdActionParams }
  | { type: 'tofax'; params: IToFaxActionParams }
  | { type: 'label'; params: ILabelActionParams }
  | { type: 'busy'; params: IBusyActionParams }
  | { type: 'hangup'; params: Partial<Record<string, never>> } // Record<string, never> doesn't work well due to JS {} values, Partial allows empty objects
);

/** Helper generic type, backwards compatible with older references if needed */
export interface IRouteAction {
  id: string;
  type: ActionType;
  params: Record<string, any>; // Used where type safety is temporarily relaxed
  condition: IRouteActionCondition;
}

export interface IRouteOptions {
  record?: boolean;
  record_all?: boolean;
  check_blacklist?: boolean;
  check_whitelist?: number;
  check_listbook?: boolean;
  check_dialto?: boolean;
  pre_command?: string;
  route_type?: number; // outbound type (1-5)
}

export interface IRouteWebhooks {
  before_dial?: string[];
  on_answer?: string[];
  on_hangup?: string[];
  custom?: string[];
}

export interface IRoute {
  uid: number;
  context_uid: number;
  name: string;
  extensions: string[];
  priority: number;
  active: number;
  options: IRouteOptions | null;
  webhooks: IRouteWebhooks | null;
  actions: IRouteAction[];
  raw_dialplan: string | null;
  user_uid: number;
  created_at: string;
  updated_at: string;
}
