import { describe, expect, it } from 'vitest';
import { CC_SETTINGS_GROUPS, groupOfTab, visibleSettingsGroups } from './settingsNav';
import { CC_SETTINGS_SLUG_BY_TAB, buildCcSettingsPath, resolveCcSettingsTab } from './settingsUrlState';

describe('settings navigation (U5.1)', () => {
  it('lists every section exactly once', () => {
    const all = CC_SETTINGS_GROUPS.flatMap((g) => g.tabs);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(Object.keys(CC_SETTINGS_SLUG_BY_TAB)));
  });

  it('every section opens by its URL, an unknown one falls back to the overview', () => {
    for (const tab of CC_SETTINGS_GROUPS.flatMap((g) => g.tabs)) {
      const slug = buildCcSettingsPath(tab).split('/').pop();
      expect(resolveCcSettingsTab(slug, null, 'overview')).toBe(tab);
    }
    expect(resolveCcSettingsTab('nonsense', null, 'overview')).toBe('overview');
    expect(resolveCcSettingsTab(undefined, null, 'overview')).toBe('overview');
  });

  it('legacy ?tab values still resolve', () => {
    expect(resolveCcSettingsTab(undefined, 'displayTokens', 'overview')).toBe('displayTokens');
    expect(resolveCcSettingsTab(undefined, 'tv-screens', 'overview')).toBe('displayTokens');
  });

  it('hides permissions without the right and keeps the others', () => {
    const noPerm = visibleSettingsGroups(false).flatMap((g) => g.tabs);
    expect(noPerm).not.toContain('permissions');
    expect(noPerm).toContain('hotkeys');
    expect(visibleSettingsGroups(true).flatMap((g) => g.tabs)).toContain('permissions');
    expect(visibleSettingsGroups(false).some((g) => g.id === 'access')).toBe(false);
  });

  it('maps a tab to its group', () => {
    expect(groupOfTab('hotkeys')).toBe('operators');
    expect(groupOfTab('callback')).toBe('quality');
  });
});
