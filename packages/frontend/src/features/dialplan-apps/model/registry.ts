import { DIALPLAN_ACTION_META, type ActionType } from '@krasterisk/shared';
import { IDialplanAppConfig } from './types';
import { VoiceRobotApp } from '../ui/apps/VoiceRobotApp/VoiceRobotApp';
import { GenericApp } from '../ui/apps/GenericApp/GenericApp';
import { TrunkApp } from '../ui/apps/TrunkApp/TrunkApp';
import { ExtenApp } from '../ui/apps/ExtenApp/ExtenApp';
import { QueueApp } from '../ui/apps/QueueApp/QueueApp';
import { IvrApp } from '../ui/apps/IvrApp/IvrApp';
import { ToRouteApp } from '../ui/apps/ToRouteApp/ToRouteApp';
import { HangupApp } from '../ui/apps/HangupApp/HangupApp';
import { GroupApp } from '../ui/apps/GroupApp/GroupApp';
import { NotifyApp } from '../ui/apps/NotifyApp/NotifyApp';
import { CallerIdApp } from '../ui/apps/CallerIdApp/CallerIdApp';
import { TrunkCarouselApp } from '../ui/apps/TrunkCarouselApp/TrunkCarouselApp';
import { PlaybackApp, buildPlaybackSchema, summarizePlayback } from '../ui/apps/PlaybackApp/PlaybackApp';
import { Text2SpeechApp, buildText2SpeechSchema } from '../ui/apps/Text2SpeechApp/Text2SpeechApp';
import { ConfBridgeApp, buildConfBridgeSchema } from '../ui/apps/ConfBridgeApp/ConfBridgeApp';

const registryDraft: Record<ActionType, Omit<IDialplanAppConfig, 'schema' | 'summarize' | 'terminal' | 'allowedIn' | 'optionFlags'> & Partial<IDialplanAppConfig>> = {
  // --- TELEPHONY & MEDIA ---
  totrunk: {
    type: 'totrunk',
    labelKey: 'routes.action.totrunk',
    component: TrunkApp,
    category: 'telephony',
    defaultParams: { trunk: '', dest: '${EXTEN}', timeout: 60, options: 'tT' },
    schema: [
      { key: 'strip', kind: 'number', labelKey: 'routes.chain.fields.strip' },
      { key: 'prepend', kind: 'text', labelKey: 'routes.chain.fields.prepend' },
    ],
  },
  toexten: {
    type: 'toexten',
    labelKey: 'routes.action.toexten',
    component: ExtenApp,
    category: 'telephony',
    defaultParams: { target: { source: 'fixed', value: '' }, webrtc: true, timeout: 60, options: 'tThH' },
    schema: [
      { key: 'target', kind: 'value-source', required: true, labelKey: 'routes.chain.fields.exten' },
      {
        key: 'webrtc',
        kind: 'toggle',
        labelKey: 'routes.chain.toexten.webrtc',
        hintKey: 'routes.chain.toexten.webrtc.hint',
      },
      { key: 'strip', kind: 'number', labelKey: 'routes.chain.fields.strip' },
      { key: 'prepend', kind: 'text', labelKey: 'routes.chain.fields.prepend' },
    ],
  },
  toqueue: {
    type: 'toqueue',
    labelKey: 'routes.action.toqueue',
    component: QueueApp,
    category: 'telephony',
    defaultParams: { target: { source: 'fixed', value: '' }, options: 'thH' },
    terminal: 'conditional',
    allowedIn: ['route', 'phonebook', 'ivr'],
    schema: [
      {
        key: 'target',
        kind: 'value-source',
        required: true,
        labelKey: 'routes.chain.fields.queue',
        optionsSource: 'queues',
      },
      {
        key: 'timeout',
        kind: 'duration',
        labelKey: 'routes.chain.fields.timeout',
      },
      {
        key: 'priority',
        kind: 'number',
        labelKey: 'routes.chain.queue.priority',
        hintKey: 'routes.chain.queue.priority.hint',
      },
      {
        key: 'announceoverride',
        kind: 'select',
        labelKey: 'routes.chain.queue.announceoverride',
        hintKey: 'routes.chain.queue.announceoverride.hint',
        optionsSource: 'prompts',
      },
      {
        key: 'options',
        kind: 'text',
        labelKey: 'routes.chain.fields.options',
      },
    ],
    summarize: (params, t) => {
      const target = params?.target;
      if (target?.source === 'route_pattern') {
        return t('routes.chain.summary.toqueue.routePattern', 'Очередь по маске маршрута');
      }
      if (target?.source === 'variable' && target.name) {
        return t('routes.chain.summary.toqueue.variable', 'Очередь из переменной');
      }
      if (target?.source === 'phonebook' && target.phonebookUid && target.varKey) {
        return t('routes.chain.summary.toqueue.phonebook', 'Очередь из справочника ({{field}})').replace(
          '{{field}}',
          String(target.varKey),
        );
      }
      const fixed = (target?.source === 'fixed' && target.value) || params?.queue;
      if (fixed) {
        return t('routes.chain.summary.toqueue.fixed', 'Очередь {{queue}}').replace('{{queue}}', String(fixed));
      }
      return t('routes.chain.summary.toqueue.empty', 'Очередь: не выбрана');
    },
  },
  togroup: {
    type: 'togroup',
    labelKey: 'routes.action.togroup',
    component: GroupApp,
    category: 'telephony',
    defaultParams: { group: '' },
    schema: [
      { key: 'strip', kind: 'number', labelKey: 'routes.chain.fields.strip' },
      { key: 'prepend', kind: 'text', labelKey: 'routes.chain.fields.prepend' },
    ],
  },
  tolist: { type: 'tolist', labelKey: 'routes.action.tolist', component: GenericApp, category: 'telephony' },
  toivr: { type: 'toivr', labelKey: 'routes.action.toivr', component: IvrApp, category: 'telephony', defaultParams: { ivr_uid: '' } },
  toroute: { type: 'toroute', labelKey: 'routes.action.toroute', component: ToRouteApp, category: 'telephony', defaultParams: { context: '', extension: '' } },
  playback: {
    type: 'playback',
    labelKey: 'routes.action.playback',
    component: PlaybackApp,
    category: 'media',
    defaultParams: { mode: 'plain', files: '', options: {} },
    schema: buildPlaybackSchema((key, fallback) => fallback ?? key),
    summarize: summarizePlayback,
    optionFlags: [],
  },
  voicerobot: { type: 'voicerobot', labelKey: 'routes.action.voicerobot', component: VoiceRobotApp, category: 'media' },
  text2speech: {
    type: 'text2speech',
    labelKey: 'routes.action.text2speech',
    component: Text2SpeechApp,
    category: 'media',
    defaultParams: { text: '', engine: '' },
    schema: buildText2SpeechSchema((key, fallback) => fallback ?? key),
  },
  confbridge: {
    type: 'confbridge',
    labelKey: 'routes.action.confbridge',
    component: ConfBridgeApp,
    category: 'media',
    defaultParams: { room: { source: 'fixed', value: '' }, options: '' },
    schema: buildConfBridgeSchema((key, fallback) => fallback ?? key),
  },
  
  // --- SYSTEM & NOTIFICATIONS ---
  setclid_custom: { type: 'setclid_custom', labelKey: 'routes.action.setclid_custom', component: CallerIdApp, category: 'system', defaultParams: { mode: 'static', callerid: '' } },
  setclid_list: { type: 'setclid_list', labelKey: 'routes.action.setclid_list', component: CallerIdApp, category: 'system', defaultParams: { mode: 'setclid_list', list_uid: '' } },
  callerid: { type: 'callerid', labelKey: 'routes.action.callerid', component: CallerIdApp, category: 'system', defaultParams: { mode: 'static', callerid: '' } },
  trunk_carousel: { type: 'trunk_carousel', labelKey: 'routes.action.trunk_carousel', component: TrunkCarouselApp, category: 'telephony', defaultParams: { mode: 'random_then_failover', trunks: [] } },
  notify: {
    type: 'notify',
    labelKey: 'routes.action.notify',
    component: NotifyApp,
    category: 'notification',
    defaultParams: { channels: [], recipients: {}, body: '' },
    schema: [
      { key: 'channels', kind: 'multiselect', labelKey: 'routes.chain.notify.channels' },
      { key: 'body', kind: 'text', labelKey: 'routes.chain.notify.body' },
    ],
  },
  voicemail: { type: 'voicemail', labelKey: 'routes.action.voicemail', component: GenericApp, category: 'notification' },
  webhook: { type: 'webhook', labelKey: 'routes.action.webhook', component: GenericApp, category: 'system' },
  cmd: { type: 'cmd', labelKey: 'routes.action.cmd', component: GenericApp, category: 'system' },
  label: { type: 'label', labelKey: 'routes.action.label', component: GenericApp, category: 'system' },
  goto: { type: 'goto', labelKey: 'routes.action.goto', component: GenericApp, category: 'system', defaultParams: { label_name: '' } },
  branch: { type: 'branch', labelKey: 'routes.action.branch', component: GenericApp, category: 'system', defaultParams: { true_label: '', false_label: '', condition: {} } },
  schedule: { type: 'schedule', labelKey: 'routes.action.schedule', component: GenericApp, category: 'system', defaultParams: { intervals: [] } },
  busy: { type: 'busy', labelKey: 'routes.action.busy', component: GenericApp, category: 'telephony' },
  congestion: { type: 'congestion', labelKey: 'routes.action.congestion', component: GenericApp, category: 'telephony', defaultParams: { timeout: 10 } },
  hangup: { type: 'hangup', labelKey: 'routes.action.hangup', component: HangupApp, category: 'telephony', defaultParams: { causecode: '' } },
};

function inferOptionFlags(options: unknown): string[] {
  if (typeof options !== 'string' || !options) return [];
  const flags: string[] = [];
  for (const ch of options) {
    if (/^[A-Za-z]$/.test(ch) && !flags.includes(ch)) flags.push(ch);
  }
  return flags;
}

function withRequiredFields(
  config: (typeof registryDraft)[ActionType],
): IDialplanAppConfig {
  const meta = DIALPLAN_ACTION_META[config.type];
  return {
    ...config,
    schema: config.schema ?? [],
    optionFlags: config.optionFlags ?? inferOptionFlags(config.defaultParams?.options),
    terminal: config.terminal ?? meta.terminal,
    allowedIn: config.allowedIn ?? meta.allowedIn,
    summarize:
      config.summarize
      ?? ((_, t) => t(config.labelKey, config.type)),
    offerOnCreate: config.offerOnCreate ?? true,
  };
}

export const dialplanAppsRegistry: Record<ActionType, IDialplanAppConfig> = Object.fromEntries(
  (Object.entries(registryDraft) as Array<[ActionType, IDialplanAppConfig]>).map(([type, config]) => [
    type,
    withRequiredFields(config),
  ]),
) as Record<ActionType, IDialplanAppConfig>;

/** Ensure the runtime keys ordered logically for Select menus */
export const ACTION_TYPES_LIST = Object.values(dialplanAppsRegistry);
