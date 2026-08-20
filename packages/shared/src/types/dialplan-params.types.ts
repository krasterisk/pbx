import type { ConditionOp, ConditionSourceKind } from './dialplan-condition.types';
import type { ITimeGroupInterval } from './timeGroup.types';

export type ValueSource =
  | { source: 'fixed'; value: string }
  | { source: 'route_pattern' }
  | { source: 'variable'; name: string }
  | { source: 'phonebook'; phonebookUid: number; varKey: string };

export type MediaMixMode = 'say' | 'mix';

/** D-26: strip digits then prepend, applied to trunk-dialing targets. */
export interface NumberManipulation {
  strip?: number;
  prepend?: string;
}

/** Structured Playback / BackGround option flags (D-38). String form is accepted and normalized. */
export interface IMediaOptions {
  noanswer?: boolean;
  skip?: boolean;
  p?: boolean;
  mixMode?: MediaMixMode;
  /** Unrecognized flags kept in original order for D-27 round-trip. */
  raw?: string;
}

export interface IMediaParams {
  file?: string;
  options?: IMediaOptions | string;
  langoverride?: string;
  digittimeout?: number;
}

export interface IQueueActionParams {
  target?: ValueSource;
  /** @deprecated Wave 0 field — read when `target` is absent */
  queue?: string;
  timeout?: number | string;
  options?: string;
  announceoverride?: string;
  priority?: number;
}

export interface IToTrunkParams {
  trunk?: string;
  dest?: ValueSource;
  timeout?: number | string;
  options?: string;
  numberManipulation?: NumberManipulation;
}

/**
 * Internal extension target.
 * `webrtc` is read by the generator and selects transport in `pjsipDialTarget`;
 * it is revived, not removed (D-39).
 */
export interface IToExtenParams {
  target: ValueSource;
  webrtc?: boolean;
  timeout?: number | string;
  options?: string;
  numberManipulation?: NumberManipulation;
  /** @deprecated Wave 0 — read when `target` is absent */
  exten?: string;
  /** @deprecated replaced by `target.source === 'route_pattern'` */
  useExten?: boolean;
}

export interface IToGroupParams {
  target?: ValueSource;
  numberManipulation?: NumberManipulation;
  /** @deprecated Wave 0 — read when `target` is absent */
  group?: string;
}

export interface IToListParams {
  numbers?: string;
  timeout?: number | string;
  options?: string;
}

export interface IToIvrParams {
  ivr_uid?: string | number;
}

export interface IToRouteParams {
  context?: string;
  extension?: ValueSource;
}

export const PLAYBACK_MODES = ['plain', 'control', 'menu'] as const;
export type PlaybackMode = (typeof PLAYBACK_MODES)[number];

export interface IPlayPromptParams extends IMediaParams {}

/** Unified Playback (D-51). `file` remains for dual-read of pre-12-12 rows. */
export interface IPlaybackParams extends IMediaParams {
  files?: string | string[];
  mode?: PlaybackMode;
  /** @deprecated dual-read until 12-12 */
  digitExit?: boolean;
  /** @deprecated dual-read until 12-12 */
  digit?: string;
  /** @deprecated dual-read until 12-12 */
  digitExitDest?: string;
}

export interface ISetClidCustomParams {
  callerid?: string;
  name?: string;
  mode?: string;
}

export interface ISetClidListParams {
  list_uid?: string | number;
  mode?: string;
}

export interface ISendMailParams {
  email?: string;
  subject?: string;
  text?: string;
}

export interface ISendMailPeerParams {
  exten?: string;
  text?: string;
}

export interface ITelegramParams {
  chat_id?: string;
  text?: string;
}

export interface IVoicemailParams {
  target?: ValueSource;
  /** @deprecated Wave 0 — read when `target` is absent */
  exten?: string;
}

export interface IText2SpeechParams {
  text?: string;
  /** Tenant TTS engine uid from the project catalog (D-30). */
  engine?: number | string;
  voice?: string;
  language?: string;
  options?: IMediaOptions | string;
  langoverride?: string;
  digittimeout?: number;
}

export interface IVoiceRobotParams {
  robot_uid?: number;
}

export interface IRecordParams {
  silence_timeout?: number | string;
  max_timer?: number | string;
  options?: IMediaOptions | string;
  langoverride?: string;
  digittimeout?: number;
}

export interface IWebhookParams {
  url?: string;
}

/**
 * ConfBridge params as the generator reads them today (`room` / `options`).
 * Profiles, PIN, admin-marked, recording, DTMF menu, and tenant-scoped room
 * names are a separate phase (D-41). Room stays without a tenant suffix for
 * this phase (accepted risk T-12-03-05).
 */
export interface IConfBridgeParams {
  room?: ValueSource;
  options?: string;
}

export interface ICmdParams {
  command?: string;
}

export interface IToFaxParams {
  email?: string;
}

export interface ILabelParams {
  label_name?: string;
}

export interface IGotoParams {
  label_name?: string;
}

export interface IBranchCondition {
  source?: ConditionSourceKind;
  values?: string[];
  device?: string;
  name?: string;
  op?: ConditionOp;
  value?: string;
  dialstatus?: string | string[];
}

export interface IBranchParams {
  true_label?: string;
  false_label?: string;
  condition?: IBranchCondition;
}

export interface IScheduleParams {
  intervals?: ITimeGroupInterval[];
}

export type HttpRequestMethod = 'GET' | 'POST';

export interface IHttpRequestParams {
  url?: string;
  method?: HttpRequestMethod;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export type CollectInputMode = 'digits' | 'extension';

export interface ICollectInputParams {
  variableName?: string;
  promptFile?: string;
  digitsCount?: number;
  timeout?: number;
  attempts?: number;
  mode?: CollectInputMode;
}

export interface IBusyParams {
  timeout?: number | string;
}

export interface IHangupParams {
  causecode?: string;
}

/** Same shape as Busy — optional timeout. Generator branch is added in 12-05. */
export interface ICongestionParams {
  timeout?: number | string;
}

