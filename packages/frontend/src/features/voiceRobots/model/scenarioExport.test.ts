import { describe, expect, it } from 'vitest';
import type {
  IVoiceRobot,
  IVoiceRobotDataList,
  IVoiceRobotKeyword,
  IVoiceRobotKeywordGroup,
} from '@/entities/voiceRobot';
import {
  buildScenarioExport,
  groupKey,
  listKey,
  parseScenarioExport,
  remapActionIn,
  SCENARIO_EXPORT_FORMAT,
} from './scenarioExport';

const group = (uid: number, name: string, extra: Partial<IVoiceRobotKeywordGroup> = {}): IVoiceRobotKeywordGroup => ({
  uid,
  robot_id: 1,
  name,
  description: null,
  priority: uid,
  active: true,
  is_global: false,
  user_uid: 1,
  ...extra,
});

const keyword = (uid: number, groupId: number, extra: Partial<IVoiceRobotKeyword> = {}): IVoiceRobotKeyword => ({
  uid,
  group_id: groupId,
  keywords: `kw-${uid}`,
  negative_keywords: [],
  synonyms: [],
  actions: [],
  bot_action: null,
  max_repeats: 0,
  escalation_action: null,
  priority: uid,
  comment: null,
  tag: null,
  user_uid: 1,
  ...extra,
});

describe('scenarioExport', () => {
  it('replaces group and list ids with portable keys so restore can remap them', () => {
    const robot: Pick<
      IVoiceRobot,
      'greeting_tts_text' | 'initial_group_id' | 'fallback_bot_action' | 'max_retries_bot_action'
    > = {
      greeting_tts_text: 'Здравствуйте',
      initial_group_id: 10,
      fallback_bot_action: {
        response: { type: 'tts', value: 'Не понял' },
        nextState: { type: 'switch_group', target: 20 },
      },
      max_retries_bot_action: null,
    };
    const file = buildScenarioExport({
      robot,
      exportedAt: '2026-08-27T00:00:00.000Z',
      groups: [group(10, 'Меню'), group(20, 'Оператор')],
      keywordsByGroupId: {
        10: [
          keyword(1, 10, {
            keywords: 'оператор',
            bot_action: {
              response: { type: 'tts', value: 'Соединяю' },
              nextState: { type: 'switch_group', target: '20' },
              dataListSearch: {
                listId: 7,
                querySource: 'last_utterance',
                returnField: 'phone',
                resultVariable: 'found',
                onFoundNextState: { type: 'switch_group', target: 20 },
              },
            },
          }),
        ],
        20: [keyword(2, 20, { keywords: 'назад' })],
      },
      dataLists: [
        {
          uid: 7,
          robot_id: 1,
          name: 'Клиенты',
          description: null,
          columns: [{ key: 'phone', label: 'Телефон', searchable: true }],
          rows: [{ phone: '7900' }],
          user_uid: 1,
          created_at: '',
          updated_at: '',
        } satisfies IVoiceRobotDataList,
      ],
    });

    expect(file.format).toBe(SCENARIO_EXPORT_FORMAT);
    expect(file.scenario.initialGroupKey).toBe(groupKey(10));
    expect(file.scenario.groups.map((g) => g.key)).toEqual([groupKey(10), groupKey(20)]);
    expect(JSON.stringify(file)).not.toMatch(/"listId":/);
    expect(file.scenario.groups[0].keywords[0].bot_action?.nextState.target).toBe(groupKey(20));
    expect(file.scenario.groups[0].keywords[0].bot_action?.dataListSearch?.listKey).toBe(listKey(7));
    expect(file.scenario.fallbackBotAction?.nextState.target).toBe(groupKey(20));
  });

  it('round-trips switch_group and listId through a new-id map', () => {
    const portable = {
      response: { type: 'none' as const },
      nextState: { type: 'switch_group' as const, target: groupKey(10) },
      dataListSearch: {
        listKey: listKey(7),
        querySource: 'slot' as const,
        querySlotName: 'inn',
        returnField: 'name',
        resultVariable: 'company',
        onFoundNextState: { type: 'switch_group' as const, target: groupKey(20) },
      },
    };
    const remapped = remapActionIn(
      portable,
      new Map([
        [groupKey(10), 101],
        [groupKey(20), 202],
      ]),
      new Map([[listKey(7), 77]]),
    );
    expect(remapped?.nextState).toEqual({ type: 'switch_group', target: '101' });
    expect(remapped?.dataListSearch?.listId).toBe(77);
    expect(remapped?.dataListSearch?.onFoundNextState).toEqual({ type: 'switch_group', target: '202' });
  });

  it('rejects unknown files', () => {
    expect(() => parseScenarioExport({ format: 'other', version: 1, scenario: { groups: [], dataLists: [] } }))
      .toThrow('invalid-format');
    expect(() => parseScenarioExport({ format: SCENARIO_EXPORT_FORMAT, version: 99, scenario: { groups: [], dataLists: [] } }))
      .toThrow('unsupported-version');
  });

  it('parses a well-formed export', () => {
    const file = buildScenarioExport({
      groups: [group(1, 'A')],
      keywordsByGroupId: { 1: [] },
      dataLists: [],
      exportedAt: '2026-08-27T00:00:00.000Z',
    });
    expect(parseScenarioExport(JSON.parse(JSON.stringify(file))).scenario.groups).toHaveLength(1);
  });
});
