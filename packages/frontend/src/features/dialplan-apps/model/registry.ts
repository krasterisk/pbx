import { ActionType } from '@krasterisk/shared';
import { IDialplanAppConfig } from './types';
import { VoiceRobotApp } from '../ui/apps/VoiceRobotApp/VoiceRobotApp';
import { GenericApp } from '../ui/apps/GenericApp/GenericApp';
import { TrunkApp } from '../ui/apps/TrunkApp/TrunkApp';
import { ExtenApp } from '../ui/apps/ExtenApp/ExtenApp';
import { QueueApp } from '../ui/apps/QueueApp/QueueApp';
import { IvrApp } from '../ui/apps/IvrApp/IvrApp';
import { PromptApp } from '../ui/apps/PromptApp/PromptApp';
import { ToRouteApp } from '../ui/apps/ToRouteApp/ToRouteApp';
import { HangupApp } from '../ui/apps/HangupApp/HangupApp';
import { GroupApp } from '../ui/apps/GroupApp/GroupApp';
import { NotifyApp } from '../ui/apps/NotifyApp/NotifyApp';

export const dialplanAppsRegistry: Record<ActionType, IDialplanAppConfig> = {
  // --- TELEPHONY & MEDIA ---
  totrunk: { type: 'totrunk', labelKey: 'routes.action.totrunk', component: TrunkApp, category: 'telephony', defaultParams: { trunk: '', dest: '${EXTEN}', timeout: 60, options: 'tT' } },
  toexten: { type: 'toexten', labelKey: 'routes.action.toexten', component: ExtenApp, category: 'telephony', defaultParams: { exten: '', timeout: 60, options: 'tThH' } },
  toqueue: { type: 'toqueue', labelKey: 'routes.action.toqueue', component: QueueApp, category: 'telephony', defaultParams: { queue: '', timeout: '', options: 'thH' } },
  togroup: { type: 'togroup', labelKey: 'routes.action.togroup', component: GroupApp, category: 'telephony', defaultParams: { group: '' } },
  tolist: { type: 'tolist', labelKey: 'routes.action.tolist', component: GenericApp, category: 'telephony' },
  toivr: { type: 'toivr', labelKey: 'routes.action.toivr', component: IvrApp, category: 'telephony', defaultParams: { ivr_uid: '' } },
  toroute: { type: 'toroute', labelKey: 'routes.action.toroute', component: ToRouteApp, category: 'telephony', defaultParams: { context: '', extension: '' } },
  playprompt: { type: 'playprompt', labelKey: 'routes.action.playprompt', component: PromptApp, category: 'media', defaultParams: { file: '' } },
  playback: { type: 'playback', labelKey: 'routes.action.playback', component: PromptApp, category: 'media', defaultParams: { file: '' } },
  voicerobot: { type: 'voicerobot', labelKey: 'routes.action.voicerobot', component: VoiceRobotApp, category: 'media' },
  text2speech: { type: 'text2speech', labelKey: 'routes.action.text2speech', component: GenericApp, category: 'media' },
  asr: { type: 'asr', labelKey: 'routes.action.asr', component: GenericApp, category: 'media' },
  keywords: { type: 'keywords', labelKey: 'routes.action.keywords', component: GenericApp, category: 'media' },
  confbridge: { type: 'confbridge', labelKey: 'routes.action.confbridge', component: GenericApp, category: 'media' },
  
  // --- SYSTEM & NOTIFICATIONS ---
  setclid_custom: { type: 'setclid_custom', labelKey: 'routes.action.setclid_custom', component: GenericApp, category: 'system' },
  setclid_list: { type: 'setclid_list', labelKey: 'routes.action.setclid_list', component: GenericApp, category: 'system' },
  callerid: { type: 'callerid', labelKey: 'routes.action.callerid', component: GenericApp, category: 'system' },
  trunk_carousel: { type: 'trunk_carousel', labelKey: 'routes.action.trunk_carousel', component: GenericApp, category: 'telephony' },
  sendmail: { type: 'sendmail', labelKey: 'routes.action.sendmail', component: GenericApp, category: 'notification' },
  sendmailpeer: { type: 'sendmailpeer', labelKey: 'routes.action.sendmailpeer', component: GenericApp, category: 'notification' },
  telegram: { type: 'telegram', labelKey: 'routes.action.telegram', component: GenericApp, category: 'notification' },
  notify: { type: 'notify', labelKey: 'routes.action.notify', component: NotifyApp, category: 'notification', defaultParams: { integration_uid: '', message: '', target: '' } },
  voicemail: { type: 'voicemail', labelKey: 'routes.action.voicemail', component: GenericApp, category: 'notification' },
  webhook: { type: 'webhook', labelKey: 'routes.action.webhook', component: GenericApp, category: 'system' },
  cmd: { type: 'cmd', labelKey: 'routes.action.cmd', component: GenericApp, category: 'system' },
  tofax: { type: 'tofax', labelKey: 'routes.action.tofax', component: GenericApp, category: 'media' },
  label: { type: 'label', labelKey: 'routes.action.label', component: GenericApp, category: 'system' },
  busy: { type: 'busy', labelKey: 'routes.action.busy', component: GenericApp, category: 'telephony' },
  hangup: { type: 'hangup', labelKey: 'routes.action.hangup', component: HangupApp, category: 'telephony', defaultParams: { causecode: '' } },
};

/** Ensure the runtime keys ordered logically for Select menus */
export const ACTION_TYPES_LIST = Object.values(dialplanAppsRegistry);
