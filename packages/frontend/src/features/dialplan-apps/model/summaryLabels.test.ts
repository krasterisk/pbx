import { describe, expect, it } from 'vitest';
import { dialplanAppsRegistry } from './registry';
import { summaryRefLabel } from './summaryLabels';
import { buildHangupSchema } from './schemas/hangup';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';

const translate = (locale: unknown) => (key: string, fallback?: string): string =>
  key.split('.').reduce<any>((value, part) => value?.[part], locale) ?? fallback ?? key;
const t = translate(ru);
const catalog = (value: string, label: string) => ({ items: [{ value, label }], isLoading: false });
const refs = {
  notifications: catalog('901', 'Telegram поддержки'),
  ivrs: catalog('902', 'Главное меню'),
  voiceRobots: catalog('903', 'Опрос клиента'),
  aiVoiceRobots: catalog('904', 'Анна'),
  conferenceRooms: catalog('905', '600 - Планёрка'),
  callGroups: catalog('906', '700 - Продажи'),
  trunkIds: catalog('t-provider_42', 'Провайдер'),
  queues: catalog('701', '701 - Поддержка'),
  endpoints: catalog('201', '201 - Иван'),
  prompts: catalog('opaque-audio-file', 'Добро пожаловать'),
  contexts: catalog('context-support', 'Поддержка'),
  dialplanDirectories: {
    ...catalog('907', 'Клиенты'),
    items: [{ value: '907', label: 'Клиенты', fields: [{ value: '908', label: 'Телефон менеджера' }] }],
  },
};

describe('dialplan catalog summaries', () => {
  it.each([
    ['notify', { integration_uid: 901 }, 'Telegram поддержки', '901'],
    ['toivr', { ivr_uid: '902' }, 'Главное меню', '902'],
    ['voicerobot', { robot_uid: 903 }, 'Опрос клиента', '903'],
    ['ai_voice_robot', { robot_uid: '904' }, 'Анна', '904'],
    ['confbridge', { room: { source: 'fixed', value: '905' } }, '600 - Планёрка', '905'],
    ['togroup', { target: { source: 'fixed', value: '906' } }, '700 - Продажи', '906'],
    ['totrunk', { trunks: [{ trunkId: 'PJSIP/t-provider_42' }] }, 'Провайдер', 't-provider_42'],
    ['toqueue', { target: { source: 'fixed', value: 'q701_42' } }, '701 - Поддержка', 'q701_42'],
    ['toexten', { target: { source: 'fixed', value: 'PJSIP/e201_42' } }, '201 - Иван', 'e201_42'],
    ['playback', { file: 'opaque-audio-file' }, 'Добро пожаловать', 'opaque-audio-file'],
    ['voicemail', { greeting: 'opaque-audio-file' }, 'Добро пожаловать', 'opaque-audio-file'],
    ['toroute', { context: 'context-support' }, 'Поддержка', 'context-support'],
    ['directory_lookup', { directoryUid: 907, outputs: [{ fieldUid: 908, targetVariable: 'PHONE' }] }, 'Клиенты', '907'],
  ] as const)('%s resolves the chosen label without displaying its identifier', (type, params, label, id) => {
    const summary = dialplanAppsRegistry[type].summarize(params, t, refs);
    expect(summary).toContain(label);
    expect(summary).not.toContain(id);
  });

  it.each(['toexten', 'toqueue'] as const)('%s resolves a directory field label', type => {
    const summary = dialplanAppsRegistry[type].summarize({ target: { source: 'directory', directoryUid: 907, valueFieldUid: 908 } }, t, refs);
    expect(summary).toContain('Телефон менеджера');
    expect(summary).not.toContain('908');
  });

  it.each(['notify', 'toivr', 'voicerobot', 'ai_voice_robot'] as const)('%s hides unavailable catalog identifiers', type => {
    const params = { integration_uid: 999, ivr_uid: 999, robot_uid: 999 };
    const summary = dialplanAppsRegistry[type].summarize(params, t, {});
    expect(summary).toContain('Объект недоступен');
    expect(summary).not.toContain('999');
  });

  it('shows loading until a selected reference can be resolved', () => {
    expect(summaryRefLabel({ notifications: { items: [], isLoading: true } }, 'notifications', 999, t)).toBe('Загрузка названия');
  });

  it('resolves legacy call group UIDs through catalog aliases', () => {
    const legacyRefs = { callGroups: { items: [{ value: '700', aliases: ['12'], label: '700 - Продажи' }], isLoading: false } };
    expect(dialplanAppsRegistry.togroup.summarize({ group: '12' }, t, legacyRefs)).toContain('700 - Продажи');
  });

  it('does not rewrite stored IDs while producing a summary', () => {
    const params = { integration_uid: 901 };
    dialplanAppsRegistry.notify.summarize(params, t, refs);
    expect(params).toEqual({ integration_uid: 901 });
  });
});

describe('hangup cause descriptions', () => {
  it.each([ru, en])('shows number and localized description in summaries and options', locale => {
    const tr = translate(locale);
    const options = buildHangupSchema(tr).find(field => field.key === 'causecode')!.options!;
    for (const option of options.filter(option => option.value)) {
      const description = tr(option.labelKey);
      expect(description).toMatch(new RegExp(`^${option.value} - .+`));
      expect(dialplanAppsRegistry.hangup.summarize({ signal: 'hangup', causecode: Number(option.value) }, tr)).toContain(description);
      expect(description).not.toContain('\u2014');
    }
  });

  it('preserves busy/congestion summaries and handles unknown legacy codes', () => {
    expect(dialplanAppsRegistry.hangup.summarize({ signal: 'busy', causecode: 17 }, t)).toContain('Занято');
    expect(dialplanAppsRegistry.hangup.summarize({ causecode: 999 }, t)).toContain('999 - Описание недоступно');
  });
});
