import type { ActionType } from '@krasterisk/shared';
import {
  ConfBridgeParamsDto,
  ToExtenParamsDto,
  ToGroupParamsDto,
  ToIvrParamsDto,
  ToListParamsDto,
  ToQueueParamsDto,
  ToRouteParamsDto,
  ToTrunkParamsDto,
  TrunkCarouselParamsDto,
  VoicemailParamsDto,
} from './address.params.dto';
import {
  CallerIdParamsDto,
  CmdParamsDto,
  LabelParamsDto,
  SetClidCustomParamsDto,
  SetClidListParamsDto,
  WebhookParamsDto,
} from './control.params.dto';
import {
  NotifyParamsDto,
  SendMailParamsDto,
  SendMailPeerParamsDto,
  TelegramParamsDto,
} from './integration.params.dto';
import {
  PlaybackParamsDto,
  PlayPromptParamsDto,
  RecordParamsDto,
  Text2SpeechParamsDto,
  ToFaxParamsDto,
  VoiceRobotParamsDto,
} from './media.params.dto';

export type ParamsDtoClass = new (...args: any[]) => object;

/**
 * Per-type params DTO registry (D-09).
 * `null` is allowed only for types that have no required params
 * (hangup / busy / congestion): nonempty params must not fail, and unknown
 * keys are stripped by whitelist when a DTO exists.
 */
export const ACTION_PARAM_DTO: Record<ActionType, ParamsDtoClass | null> = {
  totrunk: ToTrunkParamsDto,
  toexten: ToExtenParamsDto,
  toqueue: ToQueueParamsDto,
  togroup: ToGroupParamsDto,
  tolist: ToListParamsDto,
  toivr: ToIvrParamsDto,
  toroute: ToRouteParamsDto,
  playprompt: PlayPromptParamsDto,
  playback: PlaybackParamsDto,
  setclid_custom: SetClidCustomParamsDto,
  setclid_list: SetClidListParamsDto,
  sendmail: SendMailParamsDto,
  sendmailpeer: SendMailPeerParamsDto,
  telegram: TelegramParamsDto,
  notify: NotifyParamsDto,
  callerid: CallerIdParamsDto,
  trunk_carousel: TrunkCarouselParamsDto,
  voicemail: VoicemailParamsDto,
  text2speech: Text2SpeechParamsDto,
  voicerobot: VoiceRobotParamsDto,
  asr: RecordParamsDto,
  keywords: RecordParamsDto,
  webhook: WebhookParamsDto,
  confbridge: ConfBridgeParamsDto,
  cmd: CmdParamsDto,
  tofax: ToFaxParamsDto,
  label: LabelParamsDto,
  busy: null,
  hangup: null,
  congestion: null,
};

export function resolveParamsDto(type: ActionType): ParamsDtoClass | null {
  if (!Object.prototype.hasOwnProperty.call(ACTION_PARAM_DTO, type)) {
    throw new Error(`ACTION_PARAM_DTO is missing an entry for ${type}`);
  }
  return ACTION_PARAM_DTO[type];
}

export { ToQueueParamsDto } from './address.params.dto';
export { ValueSourceDto, IsValueSourceConstraint } from './value-source.dto';
export { MediaOptionsDto, serializeMediaOptions, parseMediaOptions } from './media.params.dto';
