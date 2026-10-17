import type { CcSettingsTabId } from './settingsUrlState';

export type CcSettingsGroupId = 'overview' | 'operators' | 'quality' | 'cards' | 'access' | 'screens' | 'personal';

export interface CcSettingsGroup {
  id: CcSettingsGroupId;
  tabs: CcSettingsTabId[];
}

/** Settings sections grouped by meaning (U5.1), in menu order. */
export const CC_SETTINGS_GROUPS: readonly CcSettingsGroup[] = [
  { id: 'overview', tabs: ['overview'] },
  { id: 'operators', tabs: ['shifts', 'operatorSettings', 'pauseReasons', 'autoPause', 'hotkeys'] },
  { id: 'quality', tabs: ['alertThresholds', 'callback'] },
  { id: 'cards', tabs: ['cardTemplates'] },
  { id: 'access', tabs: ['permissions'] },
  { id: 'screens', tabs: ['displayTokens', 'reportSchedules'] },
  { id: 'personal', tabs: ['myPanel'] },
];

/** Groups and tabs the current user may open (permissions needs ADMIN / SUPERVISOR). */
export function visibleSettingsGroups(canManagePermissions: boolean): CcSettingsGroup[] {
  return CC_SETTINGS_GROUPS.map((g) => ({
    ...g,
    tabs: g.tabs.filter((tab) => tab !== 'permissions' || canManagePermissions),
  })).filter((g) => g.tabs.length > 0);
}

export function groupOfTab(tab: CcSettingsTabId): CcSettingsGroupId {
  return CC_SETTINGS_GROUPS.find((g) => g.tabs.includes(tab))?.id ?? 'overview';
}
