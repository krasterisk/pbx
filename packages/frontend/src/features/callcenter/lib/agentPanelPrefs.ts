/**
 * Per-browser operator presentation: KPI period, table/cards and optional desktop tabs.
 * Panel order is fixed (`DEFAULT_PANEL_ORDER`), collapse is gone and panel visibility lives in
 * the server-side personal settings (`ui_visibility`, with admin `locks`). Stale `order` /
 * `collapsed` / `visibility` values left in localStorage by older builds are ignored and
 * removed on first read.
 */
const STORAGE_KEY = 'cc.agent.panelPrefs.v2';
/** Legacy keys - removed on first read. */
const LEGACY_KEYS = ['cc.agent.panelPrefs.v1', 'cc.agent.panelVisibility.v1'];

export type CcPanelKey = 'coworkers' | 'queues' | 'waiting' | 'history';
/** `both` is no longer offered in the UI; a stored `both` is read as `shift`. */
export type KpiDisplayMode = 'day' | 'shift' | 'both';
export type AgentPanelView = 'table' | 'cards';

/** Fixed workspace panel order. */
export const DEFAULT_PANEL_ORDER: readonly CcPanelKey[] = ['coworkers', 'queues', 'waiting', 'history'];

export interface AgentPanelPrefs {
  /** Default: this shift (same counters as Coworkers). */
  kpiDisplay: KpiDisplayMode;
  desktopTabs: boolean;
  coworkersView: AgentPanelView;
  queuesView: AgentPanelView;
}

export const PANEL_PREFS_EVENT = 'cc:panel-prefs';

function normalizeKpi(raw: unknown): KpiDisplayMode {
  if (raw === 'day') return 'day';
  return 'shift';
}

function readRaw(): { parsed: Record<string, unknown> | null; hadLegacy: boolean } {
  try {
    let hadLegacy = false;
    for (const key of LEGACY_KEYS) {
      if (localStorage.getItem(key) !== null) {
        hadLegacy = true;
        localStorage.removeItem(key);
      }
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        return { parsed: parsed as Record<string, unknown>, hadLegacy };
      }
    }
    return { parsed: null, hadLegacy };
  } catch {
    return { parsed: null, hadLegacy: false };
  }
}

function write(prefs: AgentPanelPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* private mode / quota */ }
}

export function loadAgentPanelPrefs(): AgentPanelPrefs {
  const { parsed } = readRaw();
  const prefs: AgentPanelPrefs = {
    kpiDisplay: normalizeKpi(parsed?.kpiDisplay),
    desktopTabs: parsed?.desktopTabs === true,
    coworkersView: parsed?.coworkersView === 'table' ? 'table' : 'cards',
    queuesView: parsed?.queuesView === 'table' ? 'table' : 'cards',
  };
  if (parsed && ('order' in parsed || 'collapsed' in parsed || 'visibility' in parsed || parsed.kpiDisplay === 'both')) {
    write(prefs); // drop stale keys once
  }
  return prefs;
}

export function saveAgentPanelPrefs(patch: Partial<AgentPanelPrefs>): AgentPanelPrefs {
  const prev = loadAgentPanelPrefs();
  const next: AgentPanelPrefs = {
    ...prev,
    kpiDisplay: patch.kpiDisplay !== undefined ? normalizeKpi(patch.kpiDisplay) : prev.kpiDisplay,
    desktopTabs: patch.desktopTabs ?? prev.desktopTabs,
    coworkersView: patch.coworkersView ?? prev.coworkersView,
    queuesView: patch.queuesView ?? prev.queuesView,
  };
  write(next);
  try {
    window.dispatchEvent(new Event(PANEL_PREFS_EVENT));
  } catch { /* ignore */ }
  return next;
}

/**
 * Format dual shift/day KPI for display according to operator preference.
 */
export function formatKpiPair(
  shift: number,
  day: number,
  mode: KpiDisplayMode = 'day',
): string {
  if (mode === 'shift') return String(shift);
  if (mode === 'day') return String(day);
  return `${shift} · ${day}`;
}

export function loadKpiDisplay(): KpiDisplayMode {
  return loadAgentPanelPrefs().kpiDisplay;
}

export function saveKpiDisplay(mode: KpiDisplayMode): void {
  saveAgentPanelPrefs({ kpiDisplay: mode });
}
