import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAgentPanelPrefs,
  saveAgentPanelPrefs,
  loadPanelVisibility,
  savePanelVisibility,
  DEFAULT_PANEL_ORDER,
} from './agentPanelPrefs';

describe('agentPanelPrefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults kpi to shift and full panel order', () => {
    const prefs = loadAgentPanelPrefs();
    expect(prefs.kpiDisplay).toBe('shift');
    expect(prefs.order).toEqual(DEFAULT_PANEL_ORDER);
    expect(prefs.collapsed).toEqual({});
  });

  it('migrates v1 prefs and resets kpi to shift', () => {
    localStorage.setItem(
      'cc.agent.panelPrefs.v1',
      JSON.stringify({ kpiDisplay: 'day', visibility: { queues: false } }),
    );
    const prefs = loadAgentPanelPrefs();
    expect(prefs.kpiDisplay).toBe('shift');
    expect(prefs.visibility.queues).toBe(false);
  });

  it('persists kpi, order, collapse and visibility', () => {
    saveAgentPanelPrefs({
      kpiDisplay: 'both',
      order: ['history', 'waiting', 'queues', 'coworkers'],
      collapsed: { waiting: true },
      visibility: { coworkers: false },
    });
    const prefs = loadAgentPanelPrefs();
    expect(prefs.kpiDisplay).toBe('both');
    expect(prefs.order[0]).toBe('history');
    expect(prefs.collapsed.waiting).toBe(true);
    expect(prefs.visibility.coworkers).toBe(false);
  });

  it('migrates legacy visibility key', () => {
    localStorage.setItem('cc.agent.panelVisibility.v1', JSON.stringify({ queues: false }));
    expect(loadPanelVisibility()).toEqual({ queues: false });
  });

  it('keeps legacy savePanelVisibility API', () => {
    savePanelVisibility({ history: false });
    expect(loadAgentPanelPrefs().visibility.history).toBe(false);
  });
});
