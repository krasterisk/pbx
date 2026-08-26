import type { ConditionOp, ConditionSourceKind } from './dialplan-condition.types';
import type { IIvrPhraseTtsSettings } from './ivr-phrase.types';
import type { ITrunkCarouselItem } from './notification.types';
import type { ITimeGroupInterval } from './timeGroup.types';

export type ValueSource =
  | { source: 'fixed'; value: string }
  | { source: 'route_pattern' }
  | { source: 'variable'; name: string }
  | { source: 'phonebook'; phonebookUid: number; varKey: string };

export type MediaMixMode = 'say' | 'mix';

/** D-26: strip digits then prepend. Dual-read legacy — prefer `DialTargetRewrite`. */
export interface NumberManipulation {
  strip?: number;
  prepend?: string;
}

export type DialRewriteNoMatchPolicy = 'passthrough' | 'reject';

export type DialRewriteCharset = 'phone' | 'exten' | 'generic';

export type DialRewriteConditionKind =
  | 'eq'
  | 'startsWith'
  | 'endsWith'
  | 'length'
  | 'digitMask'
  | 'regex';

export interface DialRewriteCondition {
  kind: DialRewriteConditionKind;
  value?: string;
  min?: number;
  max?: number;
}

export interface DialRewriteTransform {
  /** Replace the whole source value. */
  replaceAll?: string;
  stripStartCount?: number;
  stripStartText?: string;
  stripEndCount?: number;
  stripEndText?: string;
  replaceFind?: string;
  replaceWith?: string;
  prefix?: string;
  postfix?: string;
}

export interface DialRewriteRule {
  id: string;
  enabled?: boolean;
  /** AND. Empty = match any number. */
  conditions?: DialRewriteCondition[];
  transform: DialRewriteTransform;
}

/** First matching rule wins. Applied after ValueSource is resolved. */
export interface DialTargetRewrite {
  rules?: DialRewriteRule[];
  noMatch?: DialRewriteNoMatchPolicy;
}

export type DialRewriteErrorCode =
  | 'empty'
  | 'charset'
  | 'rejected'
  | 'invalid_regex'
  | 'invalid_transform';

export interface DialRewriteEvalResult {
  output: string;
  matchedRuleId: string | null;
  error?: DialRewriteErrorCode;
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
  /**
   * Caller priority before Queue() → Set(QUEUE_PRIO=…).
   * Prefer ValueSource (`fixed` | `variable` | `phonebook`). Plain number is dual-read legacy.
   */
  priority?: ValueSource | number;
}

export interface IToTrunkParams {
  /** `single` — one trunk; `carousel` — ordered list with failover strategy */
  trunkMode?: 'single' | 'carousel';
  trunk?: string;
  /** Carousel traversal order when `trunkMode` is `carousel` */
  mode?: 'random_then_failover' | 'sequential';
  trunks?: ITrunkCarouselItem[];
  /** CallerID mode in single trunk mode: static number or lookup from phonebook */
  cid_mode?: 'static' | 'phonebook';
  callerid?: string;
  phonebook_uid?: number;
  dest?: ValueSource;
  timeout?: number | string;
  options?: string;
  rewrite?: DialTargetRewrite;
  /** @deprecated dual-read — lifted into `rewrite` */
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
  rewrite?: DialTargetRewrite;
  /** @deprecated dual-read — lifted into `rewrite` */
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
  rewrite?: DialTargetRewrite;
}

export interface IToIvrParams {
  ivr_uid?: string | number;
}

export interface IToRouteParams {
  context?: string;
  extension?: ValueSource;
  rewrite?: DialTargetRewrite;
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
  /**
   * Per-step overrides on top of the engine settings — same contract as IVR
   * phrases and synthesized prompts, merged server-side by mergePhraseSettings.
   */
  settings?: IIvrPhraseTtsSettings;
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
  /** When set, the jump is conditional: true -> label_name, false -> false_label. */
  condition?: IBranchCondition;
  false_label?: string;
}

export interface IBranchCondition {
  source?: ConditionSourceKind;
  /** Single value or list — same shape as RouteConditionDto / dialstatus. */
  values?: string | string[];
  device?: string;
  name?: string;
  op?: ConditionOp;
  value?: string;
  dialstatus?: string | string[];
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

/** Which tone/cause the caller gets before the channel is torn down. */
export type HangupSignal = 'busy' | 'congestion' | 'hangup';

export interface IHangupParams {
  signal?: HangupSignal;
  /** Seconds to keep playing the tone — busy/congestion only. */
  timeout?: number | string;
  /** Q.850 cause code — signal 'hangup' only. */
  causecode?: string;
}

