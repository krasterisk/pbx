import { DIALPLAN_ACTION_META, type ActionType } from '@krasterisk/shared';
import { IDialplanAppConfig } from './types';
import { buildPlaybackSchema, summarizePlayback } from './schemas/playback';
import { buildText2SpeechSchema, summarizeText2Speech } from './schemas/text2speech';
import { buildConfBridgeSchema } from './schemas/confBridge';
import { buildLabelSchema, summarizeLabel } from './schemas/label';
import { buildGotoSchema, summarizeGoto } from './schemas/goto';
import { buildScheduleSchema, summarizeSchedule } from './schemas/schedule';
import { buildHttpRequestSchema, summarizeHttpRequest } from './schemas/httpRequest';
import { buildCollectInputSchema, summarizeCollectInput } from './schemas/collectInput';
import { buildHangupSchema, summarizeHangup } from './schemas/hangup';
import { buildCallerIdSchema, summarizeCallerId } from './schemas/callerid';
import { buildNotifySchema, summarizeNotify } from './schemas/notify';
import { buildToListSchema, summarizeToList } from './schemas/tolist';
import { buildToIvrSchema, summarizeToIvr } from './schemas/toivr';
import { buildVoiceRobotSchema, summarizeVoiceRobot } from './schemas/voicerobot';
import { buildToTrunkSchema, summarizeToTrunk } from './schemas/totrunk';
import { buildWebhookSchema, summarizeWebhook } from './schemas/webhook';
import { buildCmdSchema, summarizeCmd } from './schemas/cmd';
import { inferOptionFlags } from './inferOptionFlags';
import {
  renderDialModifyTarget,
  renderDialModifyExtension,
} from '../ui/DialModifyField/DialModifyField';

const registryDraft: Record<ActionType, Omit<IDialplanAppConfig, 'schema' | 'summarize' | 'terminal' | 'allowedIn' | 'optionFlags'> & Partial<IDialplanAppConfig>> = {
  // --- TELEPHONY & MEDIA ---
  totrunk: {
    type: 'totrunk',
    labelKey: 'routes.action.totrunk',
    category: 'telephony',
    defaultParams: {
      trunkMode: 'single',
      trunk: '',
      mode: 'random_then_failover',
      trunks: [],
      dest: { source: 'route_pattern' },
      timeout: 60,
      options: 'tT',
    },
    primarySection: {
      titleKey: 'routes.chain.section.params',
      title: 'Параметры',
    },
    schema: buildToTrunkSchema((key, fallback) => fallback ?? key),
    summarize: summarizeToTrunk,
  },
  toexten: {
    type: 'toexten',
    labelKey: 'routes.action.toexten',
    category: 'telephony',
    defaultParams: { target: { source: 'fixed', value: '' }, webrtc: true, timeout: 60, options: 'tThH' },
    schema: [
      {
        key: 'target',
        kind: 'value-source',
        required: true,
        group: 'primary',
        labelKey: 'routes.chain.fields.exten',
        label: 'Абонент',
        valueSourceMode: 'dial',
        optionsSource: 'endpoints',
        hintKey: 'routes.chain.source.extenHint',
        hint:
          '**Из списка** — выберите абонента проекта (номер без суффикса тенанта)\n**B-номер маршрута** — номер, который набрал абонент\n**Из переменной / справочника** — как у транка',
      },
      {
        key: 'webrtc',
        kind: 'toggle',
        group: 'params',
        labelKey: 'routes.chain.toexten.webrtc',
        label: 'Звонить на WebRTC',
        hintKey: 'routes.chain.toexten.webrtcHint',
        hint: 'Параллельно звонит браузерный телефон. Выключите, если нужен только настольный.',
      },
      {
        key: 'timeout',
        kind: 'duration',
        group: 'params',
        labelKey: 'routes.chain.fields.timeout',
        label: 'Таймаут, сек',
      },
      {
        key: 'rewrite',
        kind: 'custom',
        group: 'params',
        hideLabel: true,
        labelKey: 'routes.chain.modify.title',
        label: 'Модификация номера',
        render: renderDialModifyTarget,
      },
    ],
    summarize: (params, t) => {
      const target = params?.target;
      if (target?.source === 'route_pattern') {
        return t('routes.chain.summary.toexten.routePattern', 'Набор B-номера маршрута');
      }
      if (target?.source === 'variable' && target.name) {
        return t('routes.chain.summary.toexten.variable', 'Абонент из переменной {{name}}').replace(
          '{{name}}',
          String(target.name),
        );
      }
      if (target?.source === 'phonebook' && target.phonebookUid && target.varKey) {
        return t('routes.chain.summary.toexten.phonebook', 'Абонент из справочника ({{field}})').replace(
          '{{field}}',
          String(target.varKey),
        );
      }
      const fixed = target?.source === 'fixed' ? String(target.value ?? '').trim() : '';
      if (fixed) {
        return t('routes.chain.summary.toexten.fixed', 'Абонент {{exten}}').replace('{{exten}}', fixed);
      }
      return t('routes.chain.summary.toexten.empty', 'Абонент: не выбран');
    },
  },
  toqueue: {
    type: 'toqueue',
    labelKey: 'routes.action.toqueue',
    category: 'telephony',
    defaultParams: { target: { source: 'fixed', value: '' }, options: 'thH' },
    terminal: 'conditional',
    allowedIn: ['route', 'phonebook', 'ivr'],
    primarySection: {
      titleKey: 'routes.chain.section.queue',
      title: 'Очередь',
      tooltipKey: 'routes.chain.section.paramsTooltip',
      tooltip:
        '**Статичная очередь** — из списка\n**B-номер маршрута** — имя очереди = набранный номер\n**Из справочника** — по номеру звонящего и полю записи\n**Из переменной** — имя канала без ${}, например MY_QUEUE',
      hideFieldLabels: true,
    },
    schema: [
      {
        key: 'target',
        kind: 'value-source',
        required: true,
        group: 'primary',
        labelKey: 'routes.chain.fields.queue',
        label: 'Очередь',
        optionsSource: 'queues',
      },
      {
        key: 'timeout',
        kind: 'duration',
        group: 'params',
        labelKey: 'routes.chain.fields.timeout',
        label: 'Таймаут, сек',
      },
      {
        key: 'priority',
        kind: 'value-source',
        group: 'params',
        labelKey: 'routes.chain.queue.priority',
        label: 'Приоритет',
        hintKey: 'routes.chain.queue.priorityHint',
        hint:
          'Чем выше число, тем раньше абонента возьмут в работу.\n**0** - обычный порядок.\nМожно задать числом, из переменной или из справочника.',
        valueSourceMode: 'scalar',
      },
      {
        key: 'announceoverride',
        kind: 'select',
        group: 'params',
        labelKey: 'routes.chain.queue.announceoverride',
        label: 'Приветствие очереди',
        hintKey: 'routes.chain.queue.announceoverrideHint',
        hint: 'Запись при входе в очередь вместо стандартного приветствия.',
        optionsSource: 'prompts',
      },
    ],
    summarize: (params, t) => {
      const target = params?.target;
      if (target?.source === 'route_pattern') {
        return t('routes.chain.summary.toqueue.routePattern', 'Очередь: B-номер маршрута');
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
    category: 'telephony',
    defaultParams: { group: '' },
    optionFlags: [],
    primarySection: {
      titleKey: 'routes.chain.section.group',
      title: 'Группа вызова',
      hideFieldLabels: true,
    },
    schema: [
      {
        key: 'group',
        kind: 'select',
        required: true,
        group: 'primary',
        labelKey: 'routes.chain.fields.group',
        label: 'Группа вызова',
        optionsSource: 'callGroups',
      },
    ],
    summarize: (params, t) => {
      const group = String(params.group ?? '').trim();
      return group
        ? t('routes.chain.togroup.summary', 'Группа #{{uid}}').replace('{{uid}}', group)
        : t('routes.chain.togroup.summaryEmpty', 'Группа: не выбрана');
    },
  },
  tolist: {
    type: 'tolist',
    labelKey: 'routes.action.tolist',
    category: 'telephony',
    defaultParams: { numbers: '', timeout: 30 },
    schema: buildToListSchema((key, fallback) => fallback ?? key),
    summarize: summarizeToList,
    optionFlags: [],
  },
  toivr: {
    type: 'toivr',
    labelKey: 'routes.action.toivr',
    category: 'telephony',
    defaultParams: { ivr_uid: '' },
    schema: buildToIvrSchema((key, fallback) => fallback ?? key),
    summarize: summarizeToIvr,
  },
  toroute: {
    type: 'toroute',
    labelKey: 'routes.action.toroute',
    category: 'telephony',
    defaultParams: { context: '', extension: { source: 'route_pattern' } },
    schema: [
      {
        key: 'context',
        kind: 'select',
        required: true,
        group: 'primary',
        labelKey: 'routes.chain.fields.context',
        label: 'Контекст',
        optionsSource: 'contexts',
      },
      {
        key: 'extension',
        kind: 'value-source',
        group: 'primary',
        labelKey: 'routes.chain.fields.dest',
        label: 'Назначение',
        valueSourceMode: 'dial',
        hintKey: 'routes.chain.source.dialHint',
        hint:
          '**B-номер маршрута** — номер, который набрал звонящий\n**Фиксированное значение** — постоянный номер для набора\n**Из переменной** — номер из переменной канала\n**Из справочника** — номер из поля записи по CallerID',
      },
      {
        key: 'rewrite',
        kind: 'custom',
        group: 'primary',
        hideLabel: true,
        labelKey: 'routes.chain.modify.title',
        label: 'Модификация номера',
        render: renderDialModifyExtension,
      },
    ],
    summarize: (params, t) => {
      const ctx = String(params.context ?? '').trim() || '…';
      return t('routes.chain.toroute.summary', 'Контекст {{context}}').replace('{{context}}', ctx);
    },
  },
  playback: {
    type: 'playback',
    labelKey: 'routes.action.playback',
    category: 'media',
    defaultParams: { mode: 'plain', files: '', options: {} },
    schema: buildPlaybackSchema((key, fallback) => fallback ?? key),
    summarize: summarizePlayback,
    optionFlags: [],
  },
  voicerobot: {
    type: 'voicerobot',
    labelKey: 'routes.action.voicerobot',
    category: 'media',
    defaultParams: { robot_uid: '' },
    schema: buildVoiceRobotSchema((key, fallback) => fallback ?? key),
    summarize: summarizeVoiceRobot,
  },
  text2speech: {
    type: 'text2speech',
    labelKey: 'routes.action.text2speech',
    category: 'media',
    defaultParams: { text: '', engine: '', settings: {} },
    schema: buildText2SpeechSchema((key, fallback) => fallback ?? key),
    summarize: summarizeText2Speech,
  },
  confbridge: {
    type: 'confbridge',
    labelKey: 'routes.action.confbridge',
    category: 'media',
    defaultParams: { room: { source: 'fixed', value: '' } },
    schema: buildConfBridgeSchema((key, fallback) => fallback ?? key),
    optionFlags: [],
  },

  // --- SYSTEM & NOTIFICATIONS ---
  callerid: {
    type: 'callerid',
    labelKey: 'routes.action.callerid',
    category: 'system',
    defaultParams: { mode: 'static', callerid: '' },
    schema: buildCallerIdSchema((key, fallback) => fallback ?? key),
    summarize: summarizeCallerId,
  },
  notify: {
    type: 'notify',
    labelKey: 'routes.action.notify',
    category: 'notification',
    defaultParams: { integration_uid: '', body: '', target: '', subject: '' },
    schema: buildNotifySchema((key, fallback) => fallback ?? key),
    summarize: summarizeNotify,
  },
  voicemail: { type: 'voicemail', labelKey: 'routes.action.voicemail', category: 'notification' },
  webhook: {
    type: 'webhook',
    labelKey: 'routes.action.webhook',
    category: 'system',
    defaultParams: { url: '' },
    offerOnCreate: false,
    schema: buildWebhookSchema((key, fallback) => fallback ?? key),
    summarize: summarizeWebhook,
  },
  cmd: {
    type: 'cmd',
    labelKey: 'routes.action.cmd',
    category: 'system',
    defaultParams: { command: '' },
    schema: buildCmdSchema((key, fallback) => fallback ?? key),
    summarize: summarizeCmd,
  },
  label: {
    type: 'label',
    labelKey: 'routes.action.label',
    category: 'system',
    defaultParams: { label_name: '' },
    schema: buildLabelSchema((key, fallback) => fallback ?? key),
    summarize: summarizeLabel,
  },
  goto: {
    type: 'goto',
    labelKey: 'routes.action.goto',
    category: 'system',
    defaultParams: { label_name: '' },
    schema: buildGotoSchema((key, fallback) => fallback ?? key),
    summarize: summarizeGoto,
  },
  schedule: {
    type: 'schedule',
    labelKey: 'routes.action.schedule',
    category: 'system',
    defaultParams: { intervals: [] },
    schema: buildScheduleSchema((key, fallback) => fallback ?? key),
    summarize: summarizeSchedule,
  },
  http_request: {
    type: 'http_request',
    labelKey: 'routes.action.http_request',
    category: 'system',
    defaultParams: { url: '', method: 'GET', timeout: 5 },
    schema: buildHttpRequestSchema((key, fallback) => fallback ?? key),
    summarize: summarizeHttpRequest,
  },
  collect_input: {
    type: 'collect_input',
    labelKey: 'routes.action.collect_input',
    category: 'system',
    defaultParams: { variableName: '', digitsCount: 1, timeout: 5, mode: 'digits', promptFile: '' },
    schema: buildCollectInputSchema((key, fallback) => fallback ?? key),
    summarize: summarizeCollectInput,
  },
  hangup: {
    type: 'hangup',
    labelKey: 'routes.action.hangup',
    category: 'telephony',
    defaultParams: { signal: 'hangup', timeout: 10, causecode: '' },
    schema: buildHangupSchema((key, fallback) => fallback ?? key),
    summarize: summarizeHangup,
  },
};

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
