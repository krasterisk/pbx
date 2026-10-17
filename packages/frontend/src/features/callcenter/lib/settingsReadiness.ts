import type { CcSettingsTabId } from './settingsUrlState';

export type ReadinessItemId = 'pauses' | 'thresholds' | 'screens' | 'schedules' | 'templates' | 'hotkeys';

export interface ReadinessItem {
  id: ReadinessItemId;
  /** `true` = configured. Informational items (hotkeys) are always `true`. */
  ok: boolean;
  count?: number;
  tab: CcSettingsTabId;
  optional?: boolean;
}

export interface ReadinessInput {
  pauseReasonsCount: number | null;
  alertThresholds: Record<string, number> | null | undefined;
  screensCount: number | null;
  schedulesCount: number | null;
  templatesCount: number | null;
  hotkeysCustom: boolean;
}

/** Defaults the backend applies when the tenant never touched the thresholds (`DEFAULT_ALERT_THRESHOLDS`). */
export const DEFAULT_ALERT_THRESHOLD_VALUES: Readonly<Record<string, number>> = {
  max_wait_sec: 60,
  abandon_rate_pct: 10,
  sla_critical_pct: 70,
  agents_available_min: 1,
};

export function thresholdsAreDefault(raw: Record<string, number> | null | undefined): boolean {
  if (!raw) return true;
  return Object.entries(DEFAULT_ALERT_THRESHOLD_VALUES).every(([key, def]) => {
    const v = raw[key];
    return v === undefined || Number(v) === def;
  });
}

/**
 * Readiness checklist (U5.2) built only from queries the settings sections already make.
 * A `null` count means "not loaded yet" and is skipped, so the list never flashes "not configured".
 */
export function buildReadinessItems(input: ReadinessInput): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  if (input.pauseReasonsCount !== null) {
    items.push({ id: 'pauses', ok: input.pauseReasonsCount > 0, count: input.pauseReasonsCount, tab: 'pauseReasons' });
  }
  items.push({ id: 'thresholds', ok: true, tab: 'alertThresholds' });
  if (input.screensCount !== null) {
    items.push({ id: 'screens', ok: input.screensCount > 0, optional: true, count: input.screensCount, tab: 'displayTokens' });
  }
  if (input.schedulesCount !== null) {
    items.push({ id: 'schedules', ok: input.schedulesCount > 0, optional: true, count: input.schedulesCount, tab: 'reportSchedules' });
  }
  if (input.templatesCount !== null) {
    items.push({ id: 'templates', ok: input.templatesCount > 0, optional: true, count: input.templatesCount, tab: 'cardTemplates' });
  }
  items.push({ id: 'hotkeys', ok: true, tab: 'hotkeys' });
  return items;
}
