import type {
  IBotNextState,
  IDataListSearchConfig,
  IVoiceRobot,
  IVoiceRobotBotAction,
  IVoiceRobotDataList,
  IVoiceRobotKeyword,
  IVoiceRobotKeywordGroup,
} from '@/entities/voiceRobot';

export const SCENARIO_EXPORT_FORMAT = 'krasterisk.voice-robot.scenario';
export const SCENARIO_EXPORT_VERSION = 1;

export function groupKey(uid: number): string {
  return `group:${uid}`;
}

export function listKey(uid: number): string {
  return `list:${uid}`;
}

export type PortableNextState = {
  type: IBotNextState['type'];
  target?: string | number;
};

export type PortableDataListSearch = Omit<
  IDataListSearchConfig,
  'listId' | 'onFoundNextState' | 'notFoundNextState'
> & {
  listKey: string | null;
  onFoundNextState?: PortableNextState;
  notFoundNextState?: PortableNextState;
};

export type PortableBotAction = Omit<IVoiceRobotBotAction, 'nextState' | 'dataListSearch'> & {
  nextState: PortableNextState;
  dataListSearch?: PortableDataListSearch;
};

export interface PortableKeyword {
  keywords: string;
  negative_keywords: string[];
  synonyms: string[];
  bot_action: PortableBotAction | null;
  max_repeats: number;
  escalation_action: PortableBotAction | null;
  priority: number;
  comment: string | null;
  tag: string | null;
}

export interface PortableGroup {
  key: string;
  name: string;
  description: string | null;
  priority: number;
  active: boolean;
  is_global: boolean;
  keywords: PortableKeyword[];
}

export interface PortableDataList {
  key: string;
  name: string;
  description: string | null;
  columns: IVoiceRobotDataList['columns'];
  rows: IVoiceRobotDataList['rows'];
}

export interface ScenarioExportFile {
  format: typeof SCENARIO_EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  scenario: {
    greetingTtsText: string | null;
    initialGroupKey: string | null;
    fallbackBotAction: PortableBotAction | null;
    maxRetriesBotAction: PortableBotAction | null;
    dataLists: PortableDataList[];
    groups: PortableGroup[];
  };
}

export interface BuildScenarioExportInput {
  robot?: Pick<
    IVoiceRobot,
    'greeting_tts_text' | 'initial_group_id' | 'fallback_bot_action' | 'max_retries_bot_action'
  > | null;
  groups: IVoiceRobotKeywordGroup[];
  keywordsByGroupId: Record<number, IVoiceRobotKeyword[]>;
  dataLists: IVoiceRobotDataList[];
  exportedAt?: string;
}

function remapNextStateOut(next: IBotNextState | undefined): PortableNextState | undefined {
  if (!next) return undefined;
  if (next.type === 'switch_group' && next.target != null && next.target !== '') {
    const n = Number(next.target);
    if (Number.isFinite(n) && n > 0) {
      return { type: next.type, target: groupKey(n) };
    }
  }
  return { type: next.type, ...(next.target !== undefined ? { target: next.target } : {}) };
}

function remapActionOut(action: IVoiceRobotBotAction | null | undefined): PortableBotAction | null {
  if (!action) return null;
  const search = action.dataListSearch;
  const dataListSearch: PortableDataListSearch | undefined = search
    ? {
        querySource: search.querySource,
        querySlotName: search.querySlotName,
        returnField: search.returnField,
        resultVariable: search.resultVariable,
        notFoundResponse: search.notFoundResponse,
        onFoundResponse: search.onFoundResponse,
        maxNotFoundRetries: search.maxNotFoundRetries,
        multiMatchStrategy: search.multiMatchStrategy,
        listKey: search.listId ? listKey(search.listId) : null,
        onFoundNextState: remapNextStateOut(search.onFoundNextState),
        notFoundNextState: remapNextStateOut(search.notFoundNextState),
      }
    : undefined;
  return {
    response: action.response,
    nextState: remapNextStateOut(action.nextState) ?? { type: 'listen' },
    ...(action.slots ? { slots: action.slots } : {}),
    ...(action.webhookPayload ? { webhookPayload: action.webhookPayload } : {}),
    ...(action.webhookResponseTemplate !== undefined
      ? { webhookResponseTemplate: action.webhookResponseTemplate }
      : {}),
    ...(action.webhookAuth ? { webhookAuth: action.webhookAuth } : {}),
    ...(action.dtmfAlternative !== undefined ? { dtmfAlternative: action.dtmfAlternative } : {}),
    ...(action.delayMs !== undefined ? { delayMs: action.delayMs } : {}),
    ...(dataListSearch ? { dataListSearch } : {}),
  };
}

export function buildScenarioExport(input: BuildScenarioExportInput): ScenarioExportFile {
  const { robot, groups, keywordsByGroupId, dataLists, exportedAt } = input;
  const sortedGroups = [...groups].sort((a, b) => a.priority - b.priority || a.uid - b.uid);
  return {
    format: SCENARIO_EXPORT_FORMAT,
    version: SCENARIO_EXPORT_VERSION,
    exportedAt: exportedAt ?? new Date().toISOString(),
    scenario: {
      greetingTtsText: robot?.greeting_tts_text ?? null,
      initialGroupKey: robot?.initial_group_id ? groupKey(robot.initial_group_id) : null,
      fallbackBotAction: remapActionOut(robot?.fallback_bot_action),
      maxRetriesBotAction: remapActionOut(robot?.max_retries_bot_action),
      dataLists: dataLists.map((list) => ({
        key: listKey(list.uid),
        name: list.name,
        description: list.description,
        columns: list.columns,
        rows: list.rows,
      })),
      groups: sortedGroups.map((group) => {
        const keywords = [...(keywordsByGroupId[group.uid] ?? [])].sort(
          (a, b) => a.priority - b.priority || a.uid - b.uid,
        );
        return {
          key: groupKey(group.uid),
          name: group.name,
          description: group.description,
          priority: group.priority,
          active: group.active,
          is_global: group.is_global,
          keywords: keywords.map((kw) => ({
            keywords: kw.keywords,
            negative_keywords: kw.negative_keywords ?? [],
            synonyms: kw.synonyms ?? [],
            bot_action: remapActionOut(kw.bot_action),
            max_repeats: kw.max_repeats ?? 0,
            escalation_action: remapActionOut(kw.escalation_action),
            priority: kw.priority ?? 0,
            comment: kw.comment,
            tag: kw.tag,
          })),
        };
      }),
    },
  };
}

export function parseScenarioExport(raw: unknown): ScenarioExportFile {
  if (!raw || typeof raw !== 'object') {
    throw new Error('invalid-json');
  }
  const file = raw as Partial<ScenarioExportFile>;
  if (file.format !== SCENARIO_EXPORT_FORMAT) {
    throw new Error('invalid-format');
  }
  if (file.version !== SCENARIO_EXPORT_VERSION) {
    throw new Error('unsupported-version');
  }
  if (!file.scenario || !Array.isArray(file.scenario.groups) || !Array.isArray(file.scenario.dataLists)) {
    throw new Error('invalid-scenario');
  }
  return file as ScenarioExportFile;
}

function remapNextStateIn(
  next: PortableNextState | undefined,
  groupMap: Map<string, number>,
): IBotNextState | undefined {
  if (!next) return undefined;
  if (next.type === 'switch_group' && typeof next.target === 'string' && next.target.startsWith('group:')) {
    const mapped = groupMap.get(next.target);
    return { type: next.type, target: mapped != null ? String(mapped) : '' };
  }
  return { type: next.type, ...(next.target !== undefined ? { target: next.target } : {}) };
}

export function remapActionIn(
  action: PortableBotAction | null | undefined,
  groupMap: Map<string, number>,
  listMap: Map<string, number>,
): IVoiceRobotBotAction | null {
  if (!action) return null;
  const search = action.dataListSearch;
  const dataListSearch: IDataListSearchConfig | undefined = search
    ? {
        listId: search.listKey ? (listMap.get(search.listKey) ?? 0) : 0,
        querySource: search.querySource,
        querySlotName: search.querySlotName,
        returnField: search.returnField,
        resultVariable: search.resultVariable,
        notFoundResponse: search.notFoundResponse,
        onFoundResponse: search.onFoundResponse,
        maxNotFoundRetries: search.maxNotFoundRetries,
        multiMatchStrategy: search.multiMatchStrategy,
        onFoundNextState: remapNextStateIn(search.onFoundNextState, groupMap),
        notFoundNextState: remapNextStateIn(search.notFoundNextState, groupMap),
      }
    : undefined;
  return {
    response: action.response,
    nextState: remapNextStateIn(action.nextState, groupMap) ?? { type: 'listen' },
    ...(action.slots ? { slots: action.slots } : {}),
    ...(action.webhookPayload ? { webhookPayload: action.webhookPayload } : {}),
    ...(action.webhookResponseTemplate !== undefined
      ? { webhookResponseTemplate: action.webhookResponseTemplate }
      : {}),
    ...(action.webhookAuth ? { webhookAuth: action.webhookAuth } : {}),
    ...(action.dtmfAlternative !== undefined ? { dtmfAlternative: action.dtmfAlternative } : {}),
    ...(action.delayMs !== undefined ? { delayMs: action.delayMs } : {}),
    ...(dataListSearch ? { dataListSearch } : {}),
  };
}

export function downloadJsonFile(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
