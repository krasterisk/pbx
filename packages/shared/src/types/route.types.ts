import type { ConditionOp, ConditionSourceKind } from './dialplan-condition.types';
import type { IRoutePhonebookBinding } from './phonebook.types';
import type {
  ICallerIdActionParams,
  INotifyActionParams,
  ITrunkCarouselActionParams,
} from './notification.types';
import type {
  IBusyParams,
  ICmdParams,
  IConfBridgeParams,
  ICongestionParams,
  IHangupParams,
  ILabelParams,
  IPlaybackParams,
  IPlayPromptParams,
  IQueueActionParams,
  IRecordParams,
  ISendMailParams,
  ISendMailPeerParams,
  ISetClidCustomParams,
  ISetClidListParams,
  ITelegramParams,
  IText2SpeechParams,
  IToExtenParams,
  IToFaxParams,
  IToGroupParams,
  IToIvrParams,
  IToListParams,
  IToRouteParams,
  IToTrunkParams,
  IVoiceRobotParams,
  IVoicemailParams,
  IWebhookParams,
} from './dialplan-params.types';

export type ActionType =
  | 'totrunk' | 'toexten' | 'toqueue' | 'togroup' | 'tolist'
  | 'toivr' | 'toroute' | 'playprompt' | 'playback'
  | 'setclid_custom' | 'setclid_list'
  | 'sendmail' | 'sendmailpeer' | 'telegram'
  | 'notify' | 'callerid' | 'trunk_carousel'
  | 'voicemail' | 'text2speech' | 'voicerobot' | 'asr' | 'keywords'
  | 'webhook' | 'confbridge' | 'cmd' | 'tofax'
  | 'label' | 'busy' | 'hangup' | 'congestion';

/** Asterisk DIALSTATUS values — used as condition whitelist */
export type DialStatus =
  | 'CHANUNAVAIL' | 'CONGESTION' | 'BUSY' | 'NOANSWER' | 'ANSWER'
  | 'CANCEL' | 'DONTCALL' | 'TORTURE' | 'INVALIDARGS';

/** Action category for UI grouping in <optgroup> */
export type ActionCategory = 'telephony' | 'media' | 'notification' | 'system';

export interface IRouteActionCondition {
  /** Discriminated condition source (D-22). Absent = legacy dialstatus-only payload. */
  source?: ConditionSourceKind;
  values?: string[];
  device?: string;
  name?: string;
  op?: ConditionOp;
  value?: string;
  /** Single status or array of statuses (OR logic). Empty/undefined = any status. */
  dialstatus?: DialStatus | DialStatus[] | '';
  time_group_uid?: number;
  /** @deprecated Use time_group_uid instead */
  calendar?: string;
}

interface BaseRouteAction {
  id: string;
  condition: IRouteActionCondition;
}

export type {
  IBusyParams as IBusyActionParams,
  ICmdParams as ICmdActionParams,
  IConfBridgeParams as IConfbridgeActionParams,
  IHangupParams,
  ILabelParams as ILabelActionParams,
  IPlayPromptParams as IPromptActionParams,
  IQueueActionParams,
  IRecordParams as IRecordActionParams,
  ISendMailParams as ISendMailActionParams,
  ISendMailPeerParams as ISendMailPeerActionParams,
  ISetClidCustomParams as ISetClidCustomActionParams,
  ISetClidListParams as ISetClidListActionParams,
  ITelegramParams as ITelegramActionParams,
  IText2SpeechParams as IText2SpeechActionParams,
  IToExtenParams as IExtenActionParams,
  IToFaxParams as IToFaxActionParams,
  IToGroupParams as IGroupActionParams,
  IToIvrParams as IIvrActionParams,
  IToListParams as IListActionParams,
  IToRouteParams as IRouteActionParams,
  IToTrunkParams as ITrunkActionParams,
  IVoiceRobotParams as IVoiceRobotActionParams,
  IVoicemailParams as IVoicemailActionParams,
  IWebhookParams as IWebhookActionParams,
} from './dialplan-params.types';

export type DialplanAction = BaseRouteAction & (
  | { type: 'totrunk'; params: IToTrunkParams }
  | { type: 'toexten'; params: IToExtenParams }
  | { type: 'toqueue'; params: IQueueActionParams }
  | { type: 'togroup'; params: IToGroupParams }
  | { type: 'tolist'; params: IToListParams }
  | { type: 'toivr'; params: IToIvrParams }
  | { type: 'toroute'; params: IToRouteParams }
  | { type: 'playprompt'; params: IPlayPromptParams }
  | { type: 'playback'; params: IPlaybackParams }
  | { type: 'setclid_custom'; params: ISetClidCustomParams }
  | { type: 'setclid_list'; params: ISetClidListParams }
  | { type: 'sendmail'; params: ISendMailParams }
  | { type: 'sendmailpeer'; params: ISendMailPeerParams }
  | { type: 'telegram'; params: ITelegramParams }
  | { type: 'notify'; params: INotifyActionParams }
  | { type: 'callerid'; params: ICallerIdActionParams }
  | { type: 'trunk_carousel'; params: ITrunkCarouselActionParams }
  | { type: 'voicemail'; params: IVoicemailParams }
  | { type: 'text2speech'; params: IText2SpeechParams }
  | { type: 'voicerobot'; params: IVoiceRobotParams }
  | { type: 'asr'; params: IRecordParams }
  | { type: 'keywords'; params: IRecordParams }
  | { type: 'webhook'; params: IWebhookParams }
  | { type: 'confbridge'; params: IConfBridgeParams }
  | { type: 'cmd'; params: ICmdParams }
  | { type: 'tofax'; params: IToFaxParams }
  | { type: 'label'; params: ILabelParams }
  | { type: 'busy'; params: IBusyParams }
  | { type: 'hangup'; params: IHangupParams }
  | { type: 'congestion'; params: ICongestionParams }
);

/** Exhaustiveness helper for `switch (action.type)` without `default` (D-08). */
export function assertNeverAction(x: never): never {
  throw new Error(`Unexpected dialplan action: ${JSON.stringify(x)}`);
}

/** Helper generic type, backwards compatible with older references if needed */
export interface IRouteAction {
  id: string;
  type: ActionType;
  params: Record<string, any>;
  condition: IRouteActionCondition;
}

export interface IRouteOptions {
  record?: boolean;
  record_all?: boolean;
  /** Stereo interleaved recording (MixMonitor D) — RX/TX on separate channels */
  record_stereo?: boolean;
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
  /** Ordered chain of phonebook-binding policies applied before actions (D-03, D-05) */
  bindings?: IRoutePhonebookBinding[];
  raw_dialplan: string | null;
  user_uid: number;
  created_at: string;
  updated_at: string;
}
