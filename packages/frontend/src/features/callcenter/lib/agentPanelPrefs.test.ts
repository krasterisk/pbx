import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAgentPanelPrefs,
  saveAgentPanelPrefs,
  DEFAULT_PANEL_ORDER,
} from './agentPanelPrefs';

const KEY = 'cc.agent.panelPrefs.v2';

describe('agentPanelPrefs (U2.8)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults kpi to shift and has a fixed panel order', () => {
    expect(loadAgentPanelPrefs()).toEqual({ kpiDisplay: 'shift', desktopTabs: true, coworkersView: 'table', queuesView: 'table' });
    expect(DEFAULT_PANEL_ORDER).toEqual(['coworkers', 'queues', 'waiting', 'history']);
  });

  it('persists the kpi period', () => {
    saveAgentPanelPrefs({ kpiDisplay: 'day' });
    expect(loadAgentPanelPrefs().kpiDisplay).toBe('day');
  });

  it('retains each panel view and desktop tabs when another personal preference changes', () => {
    saveAgentPanelPrefs({ desktopTabs: true, coworkersView: 'table' });
    saveAgentPanelPrefs({ queuesView: 'table' });
    saveAgentPanelPrefs({ kpiDisplay: 'day' });
    expect(loadAgentPanelPrefs()).toEqual({ kpiDisplay: 'day', desktopTabs: true, coworkersView: 'table', queuesView: 'table' });
  });

  it('reads the retired "both" mode as shift', () => {
    localStorage.setItem(KEY, JSON.stringify({ kpiDisplay: 'both' }));
    expect(loadAgentPanelPrefs().kpiDisplay).toBe('shift');
  });

  it('ignores and removes a stale order / collapsed / visibility from localStorage', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        kpiDisplay: 'day',
        order: ['history', 'waiting', 'queues', 'coworkers'],
        collapsed: { waiting: true },
        visibility: { coworkers: false },
      }),
    );
    const prefs = loadAgentPanelPrefs();
    expect(prefs).toEqual({ kpiDisplay: 'day', desktopTabs: true, coworkersView: 'table', queuesView: 'table' });
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({ kpiDisplay: 'day', desktopTabs: true, coworkersView: 'table', queuesView: 'table' });
  });

  it('removes legacy v1 keys', () => {
    localStorage.setItem('cc.agent.panelPrefs.v1', JSON.stringify({ kpiDisplay: 'day' }));
    localStorage.setItem('cc.agent.panelVisibility.v1', JSON.stringify({ queues: false }));
    loadAgentPanelPrefs();
    expect(localStorage.getItem('cc.agent.panelPrefs.v1')).toBeNull();
    expect(localStorage.getItem('cc.agent.panelVisibility.v1')).toBeNull();
  });
});
