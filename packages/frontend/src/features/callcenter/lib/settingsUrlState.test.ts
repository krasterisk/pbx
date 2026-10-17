import { describe, expect, it } from 'vitest';
import { buildCcSettingsPath, resolveCcSettingsTab } from './settingsUrlState';

describe('settingsUrlState (U0.8)', () => {
  it('resolves /callcenter/settings/thresholds and legacy camelCase tabs', () => {
    expect(resolveCcSettingsTab('thresholds')).toBe('alertThresholds');
    expect(resolveCcSettingsTab(null, 'alertThresholds')).toBe('alertThresholds');
    expect(resolveCcSettingsTab('pause-reasons')).toBe('pauseReasons');
    expect(resolveCcSettingsTab('unknown-slug', null, 'cardTemplates')).toBe('cardTemplates');
  });

  it('builds canonical kebab-case paths for settings sections', () => {
    expect(buildCcSettingsPath('alertThresholds')).toBe('/callcenter/settings/thresholds');
    expect(buildCcSettingsPath('pauseReasons')).toBe('/callcenter/settings/pause-reasons');
  });
});
