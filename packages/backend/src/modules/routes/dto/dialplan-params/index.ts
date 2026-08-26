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
  VoicemailParamsDto,
} from './address.params.dto';
import {
  CallerIdParamsDto,
  CmdParamsDto,
  GotoParamsDto,
  HangupParamsDto,
  LabelParamsDto,
  ScheduleParamsDto,
  WebhookParamsDto,
} from './control.params.dto';
import {
  CollectInputParamsDto,
  HttpRequestParamsDto,
  NotifyParamsDto,
} from './integration.params.dto';
import {
  PlaybackParamsDto,
  Text2SpeechParamsDto,
  VoiceRobotParamsDto,
} from './media.params.dto';

export type ParamsDtoClass = new (...args: any[]) => object;

/**
 * Per-type params DTO registry (D-09).
 * `null` is allowed only for types that have no params at all: nonempty params
 * must not fail, and unknown keys are stripped by whitelist when a DTO exists.
 */
export const ACTION_PARAM_DTO: Record<ActionType, ParamsDtoClass | null> = {
  totrunk: ToTrunkParamsDto,
  toexten: ToExtenParamsDto,
  toqueue: ToQueueParamsDto,
  togroup: ToGroupParamsDto,
  tolist: ToListParamsDto,
  toivr: ToIvrParamsDto,
  toroute: ToRouteParamsDto,
  playback: PlaybackParamsDto,
  notify: NotifyParamsDto,
  callerid: CallerIdParamsDto,
  voicemail: VoicemailParamsDto,
  text2speech: Text2SpeechParamsDto,
  voicerobot: VoiceRobotParamsDto,
  webhook: WebhookParamsDto,
  confbridge: ConfBridgeParamsDto,
  cmd: CmdParamsDto,
  label: LabelParamsDto,
  goto: GotoParamsDto,
  schedule: ScheduleParamsDto,
  http_request: HttpRequestParamsDto,
  collect_input: CollectInputParamsDto,
  hangup: HangupParamsDto,
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
