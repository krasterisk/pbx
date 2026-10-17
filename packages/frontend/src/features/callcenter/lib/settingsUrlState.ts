export type CcSettingsTabId =
  | 'overview'
  | 'cardTemplates'
  | 'pauseReasons'
  | 'autoPause'
  | 'shifts'
  | 'callback'
  | 'alertThresholds'
  | 'operatorSettings'
  | 'myPanel'
  | 'permissions'
  | 'displayTokens'
  | 'reportSchedules'
  | 'hotkeys';

export const CC_SETTINGS_SLUG_BY_TAB: Record<CcSettingsTabId, string> = {
  overview: 'overview',
  cardTemplates: 'card-templates',
  pauseReasons: 'pause-reasons',
  autoPause: 'auto-pause',
  shifts: 'shifts',
  callback: 'callback',
  alertThresholds: 'thresholds',
  operatorSettings: 'operators',
  myPanel: 'my-panel',
  permissions: 'permissions',
  displayTokens: 'display-tokens',
  reportSchedules: 'report-schedules',
  hotkeys: 'hotkeys',
};

const TAB_BY_SLUG: Record<string, CcSettingsTabId> = {
  overview: 'overview',
  'card-templates': 'cardTemplates',
  cardtemplates: 'cardTemplates',
  'pause-reasons': 'pauseReasons',
  pausereasons: 'pauseReasons',
  'auto-pause': 'autoPause',
  autopause: 'autoPause',
  shifts: 'shifts',
  callback: 'callback',
  thresholds: 'alertThresholds',
  'alert-thresholds': 'alertThresholds',
  alertthresholds: 'alertThresholds',
  operators: 'operatorSettings',
  'operator-settings': 'operatorSettings',
  operatorsettings: 'operatorSettings',
  'my-panel': 'myPanel',
  mypanel: 'myPanel',
  permissions: 'permissions',
  'display-tokens': 'displayTokens',
  displaytokens: 'displayTokens',
  'tv-screens': 'displayTokens',
  'report-schedules': 'reportSchedules',
  reportschedules: 'reportSchedules',
  hotkeys: 'hotkeys',
};

export function resolveCcSettingsTab(
  sectionParam?: string | null,
  tabSearchParam?: string | null,
  fallback: CcSettingsTabId = 'cardTemplates',
): CcSettingsTabId {
  const raw = (sectionParam || tabSearchParam || '').trim().toLowerCase();
  if (!raw) return fallback;
  return TAB_BY_SLUG[raw] ?? fallback;
}

export function buildCcSettingsPath(tabId: CcSettingsTabId): string {
  const slug = CC_SETTINGS_SLUG_BY_TAB[tabId] ?? 'card-templates';
  return `/callcenter/settings/${slug}`;
}
