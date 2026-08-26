/**
 * Operator ARM layout prefs (visibility, order, collapse, KPI mode).
 * localStorage - per-browser UX preference, same pattern as panel chips.
 */
const STORAGE_KEY = 'cc.agent.panelPrefs.v2';
/** Legacy keys - migrated on first read. */
const LEGACY_PREFS_KEY = 'cc.agent.panelPrefs.v1';
const LEGACY_VISIBILITY_KEY = 'cc.agent.panelVisibility.v1';

export type CcPanelKey = 'coworkers' | 'queues' | 'waiting' | 'history';
export type KpiDisplayMode = 'day' | 'shift' | 'both';
export type CcCollapsiblePanel = 'waiting' | 'history';

export const DEFAULT_PANEL_ORDER: CcPanelKey[] = ['coworkers', 'queues', 'waiting', 'history'];

export type CcPanelVisibility = Partial<Record<CcPanelKey, boolean>>;
export type CcPanelCollapsed = Partial<Record<CcCollapsiblePanel, boolean>>;

export interface AgentPanelPrefs {
  visibility: CcPanelVisibility;
  order: CcPanelKey[];
  collapsed: CcPanelCollapsed;
  /** Default: this shift (same counters as Coworkers). */
  kpiDisplay: KpiDisplayMode;
}

const PANEL_KEYS: CcPanelKey[] = ['coworkers', 'queues', 'waiting', 'history'];

export const PANEL_PREFS_EVENT = 'cc:panel-prefs';

function normalizeOrder(raw: unknown): CcPanelKey[] {
  const seen = new Set<CcPanelKey>();
  const out: CcPanelKey[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (PANEL_KEYS.includes(item as CcPanelKey) && !seen.has(item as CcPanelKey)) {
        seen.add(item as CcPanelKey);
        out.push(item as CcPanelKey);
      }
    }
  }
  for (const key of DEFAULT_PANEL_ORDER) {
    if (!seen.has(key)) out.push(key);
  }
  return out;
}

function normalizeKpi(raw: unknown): KpiDisplayMode {
  if (raw === 'day' || raw === 'shift' || raw === 'both') return raw;
  return 'shift';
}

function readRaw(): Partial<AgentPanelPrefs> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as Partial<AgentPanelPrefs>;
    }
    // Migrate v1 prefs - reset kpi to shift so status bar matches Coworkers
    const legacyPrefs = localStorage.getItem(LEGACY_PREFS_KEY);
    if (legacyPrefs) {
      const parsed = JSON.parse(legacyPrefs) as unknown;
      if (parsed && typeof parsed === 'object') {
        const prev = parsed as Partial<AgentPanelPrefs>;
        return { ...prev, kpiDisplay: 'shift' };
      }
    }
    // One-time migrate legacy visibility map
    const legacy = localStorage.getItem(LEGACY_VISIBILITY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown;
      if (parsed && typeof parsed === 'object') {
        return { visibility: parsed as CcPanelVisibility };
      }
    }
  } catch { /* ignore */ }
  return {};
}

export function loadAgentPanelPrefs(): AgentPanelPrefs {
  const raw = readRaw();
  const visibility: CcPanelVisibility = {};
  if (raw.visibility && typeof raw.visibility === 'object') {
    for (const key of PANEL_KEYS) {
      const v = (raw.visibility as Record<string, unknown>)[key];
      if (typeof v === 'boolean') visibility[key] = v;
    }
  }
  const collapsed: CcPanelCollapsed = {};
  if (raw.collapsed && typeof raw.collapsed === 'object') {
    for (const key of ['waiting', 'history'] as const) {
      const v = (raw.collapsed as Record<string, unknown>)[key];
      if (typeof v === 'boolean') collapsed[key] = v;
    }
  }
  return {
    visibility,
    order: normalizeOrder(raw.order),
    collapsed,
    kpiDisplay: normalizeKpi(raw.kpiDisplay),
  };
}

export function saveAgentPanelPrefs(patch: Partial<AgentPanelPrefs>): AgentPanelPrefs {
  const prev = loadAgentPanelPrefs();
  const next: AgentPanelPrefs = {
    visibility: { ...prev.visibility, ...(patch.visibility ?? {}) },
    order: patch.order ? normalizeOrder(patch.order) : prev.order,
    collapsed: { ...prev.collapsed, ...(patch.collapsed ?? {}) },
    kpiDisplay: patch.kpiDisplay !== undefined ? normalizeKpi(patch.kpiDisplay) : prev.kpiDisplay,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(PANEL_PREFS_EVENT));
  } catch { /* private mode / quota */ }
  return next;
}

/** @deprecated use loadAgentPanelPrefs().visibility */
export function loadPanelVisibility(): CcPanelVisibility {
  return loadAgentPanelPrefs().visibility;
}

/** @deprecated use saveAgentPanelPrefs({ visibility }) */
export function savePanelVisibility(visibility: CcPanelVisibility): void {
  saveAgentPanelPrefs({ visibility });
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
