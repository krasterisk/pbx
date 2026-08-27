import type {
  IVoiceRobot,
  IVoiceRobotDataList,
  IVoiceRobotKeyword,
  IVoiceRobotKeywordGroup,
} from '@/entities/voiceRobot';
import { remapActionIn, type ScenarioExportFile } from './scenarioExport';

export interface ApplyScenarioImportDeps {
  createDataList: (data: Partial<IVoiceRobotDataList>) => Promise<IVoiceRobotDataList>;
  createGroup: (data: Partial<IVoiceRobotKeywordGroup>) => Promise<IVoiceRobotKeywordGroup>;
  createKeyword: (groupId: number, data: Partial<IVoiceRobotKeyword>) => Promise<IVoiceRobotKeyword>;
  updateRobot: (data: Partial<IVoiceRobot>) => Promise<unknown>;
}

export interface ApplyScenarioImportResult {
  groups: number;
  keywords: number;
  dataLists: number;
  robotPatch: Partial<IVoiceRobot>;
}

export async function applyScenarioImport(
  file: ScenarioExportFile,
  deps: ApplyScenarioImportDeps,
): Promise<ApplyScenarioImportResult> {
  const listMap = new Map<string, number>();
  for (const list of file.scenario.dataLists) {
    const created = await deps.createDataList({
      name: list.name,
      description: list.description,
      columns: list.columns,
      rows: list.rows,
    });
    listMap.set(list.key, created.uid);
  }

  const groupMap = new Map<string, number>();
  for (const group of file.scenario.groups) {
    const created = await deps.createGroup({
      name: group.name,
      description: group.description,
      priority: group.priority,
      active: group.active,
      is_global: group.is_global,
    });
    groupMap.set(group.key, created.uid);
  }

  let keywords = 0;
  for (const group of file.scenario.groups) {
    const newGroupId = groupMap.get(group.key);
    if (newGroupId == null) continue;
    for (const kw of group.keywords) {
      await deps.createKeyword(newGroupId, {
        keywords: kw.keywords,
        negative_keywords: kw.negative_keywords,
        synonyms: kw.synonyms,
        bot_action: remapActionIn(kw.bot_action, groupMap, listMap),
        escalation_action: remapActionIn(kw.escalation_action, groupMap, listMap),
        max_repeats: kw.max_repeats,
        priority: kw.priority,
        comment: kw.comment,
        tag: kw.tag,
      });
      keywords += 1;
    }
  }

  const initialGroupId = file.scenario.initialGroupKey
    ? (groupMap.get(file.scenario.initialGroupKey) ?? null)
    : null;

  const robotPatch: Partial<IVoiceRobot> = {
    greeting_tts_text: file.scenario.greetingTtsText,
    initial_group_id: initialGroupId,
    fallback_bot_action: remapActionIn(file.scenario.fallbackBotAction, groupMap, listMap),
    max_retries_bot_action: remapActionIn(file.scenario.maxRetriesBotAction, groupMap, listMap),
  };

  await deps.updateRobot(robotPatch);

  return {
    groups: file.scenario.groups.length,
    keywords,
    dataLists: file.scenario.dataLists.length,
    robotPatch,
  };
}
