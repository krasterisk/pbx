import { describe, expect, it, vi } from 'vitest';
import { applyScenarioImport } from './applyScenarioImport';
import {
  buildScenarioExport,
  groupKey,
  SCENARIO_EXPORT_FORMAT,
  SCENARIO_EXPORT_VERSION,
  type ScenarioExportFile,
} from './scenarioExport';
import type { IVoiceRobotKeywordGroup } from '@/entities/voiceRobot';

describe('applyScenarioImport', () => {
  it('creates lists and groups first, then remaps keyword actions to new ids', async () => {
    const file: ScenarioExportFile = {
      format: SCENARIO_EXPORT_FORMAT,
      version: SCENARIO_EXPORT_VERSION,
      exportedAt: '2026-08-27T00:00:00.000Z',
      scenario: {
        greetingTtsText: 'Привет',
        initialGroupKey: groupKey(1),
        fallbackBotAction: null,
        maxRetriesBotAction: null,
        dataLists: [
          {
            key: 'list:9',
            name: 'Города',
            description: null,
            columns: [{ key: 'city', label: 'Город', searchable: true }],
            rows: [{ city: 'Москва' }],
          },
        ],
        groups: [
          {
            key: groupKey(1),
            name: 'Старт',
            description: null,
            priority: 0,
            active: true,
            is_global: false,
            keywords: [
              {
                keywords: 'москва',
                negative_keywords: [],
                synonyms: [],
                bot_action: {
                  response: { type: 'none' },
                  nextState: { type: 'search_data_list' },
                  dataListSearch: {
                    listKey: 'list:9',
                    querySource: 'last_utterance',
                    returnField: 'city',
                    resultVariable: 'city',
                    onFoundNextState: { type: 'switch_group', target: groupKey(2) },
                  },
                },
                max_repeats: 0,
                escalation_action: null,
                priority: 0,
                comment: null,
                tag: null,
              },
            ],
          },
          {
            key: groupKey(2),
            name: 'Город найден',
            description: null,
            priority: 1,
            active: true,
            is_global: false,
            keywords: [],
          },
        ],
      },
    };

    const createDataList = vi.fn().mockResolvedValue({ uid: 90 });
    const createGroup = vi
      .fn()
      .mockResolvedValueOnce({ uid: 11 } satisfies Pick<IVoiceRobotKeywordGroup, 'uid'>)
      .mockResolvedValueOnce({ uid: 22 });
    const createKeyword = vi.fn().mockResolvedValue({ uid: 33 });
    const updateRobot = vi.fn().mockResolvedValue({});

    const result = await applyScenarioImport(file, {
      createDataList,
      createGroup,
      createKeyword,
      updateRobot,
    });

    expect(result.groups).toBe(2);
    expect(result.keywords).toBe(1);
    expect(result.dataLists).toBe(1);
    expect(result.robotPatch.initial_group_id).toBe(11);
    expect(createKeyword).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        keywords: 'москва',
        bot_action: expect.objectContaining({
          dataListSearch: expect.objectContaining({
            listId: 90,
            onFoundNextState: { type: 'switch_group', target: '22' },
          }),
        }),
      }),
    );
    expect(updateRobot).toHaveBeenCalledWith(
      expect.objectContaining({
        greeting_tts_text: 'Привет',
        initial_group_id: 11,
      }),
    );
  });

  it('is the inverse of buildScenarioExport for group switches', async () => {
    const exported = buildScenarioExport({
      robot: {
        greeting_tts_text: null,
        initial_group_id: 5,
        fallback_bot_action: null,
        max_retries_bot_action: null,
      },
      groups: [
        {
          uid: 5,
          robot_id: 1,
          name: 'A',
          description: null,
          priority: 0,
          active: true,
          is_global: false,
          user_uid: 1,
        },
      ],
      keywordsByGroupId: {
        5: [
          {
            uid: 1,
            group_id: 5,
            keywords: 'да',
            negative_keywords: [],
            synonyms: [],
            actions: [],
            bot_action: {
              response: { type: 'none' },
              nextState: { type: 'switch_group', target: 5 },
            },
            max_repeats: 0,
            escalation_action: null,
            priority: 0,
            comment: null,
            tag: null,
            user_uid: 1,
          },
        ],
      },
      dataLists: [],
    });

    const createKeyword = vi.fn().mockResolvedValue({ uid: 1 });
    await applyScenarioImport(exported, {
      createDataList: vi.fn(),
      createGroup: vi.fn().mockResolvedValue({ uid: 500 }),
      createKeyword,
      updateRobot: vi.fn().mockResolvedValue({}),
    });

    expect(createKeyword.mock.calls[0][1].bot_action.nextState).toEqual({
      type: 'switch_group',
      target: '500',
    });
  });
});
