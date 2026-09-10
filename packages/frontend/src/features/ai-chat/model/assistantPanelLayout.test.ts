import { describe, it, expect, beforeEach } from 'vitest';
import {
    ASSISTANT_PANEL_LAYOUT_KEY,
    applyResize,
    clampDockWidth,
    emptyLayout,
    layoutCssVars,
    readAssistantPanelLayout,
    writeAssistantPanelLayout,
} from './assistantPanelLayout';

describe('assistantPanelLayout', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults the dock to 60% of the viewport and clamps the rails', () => {
        expect(emptyLayout(1280)).toEqual({
            dockWidth: 768,
            railWidth: 240,
            planWidth: 240,
        });
        expect(clampDockWidth(120, 1280)).toBe(360);
        expect(clampDockWidth(2000, 1280)).toBe(1178);
    });

    it('restores a remembered layout and writes it back', () => {
        writeAssistantPanelLayout({ dockWidth: 640, railWidth: 200, planWidth: 280 });
        expect(readAssistantPanelLayout(1280)).toEqual({
            dockWidth: 640,
            railWidth: 200,
            planWidth: 280,
        });
        expect(localStorage.getItem(ASSISTANT_PANEL_LAYOUT_KEY)).toContain('640');
    });

    it('widens the dock when the left edge is dragged left', () => {
        const next = applyResize(
            { dockWidth: 768, railWidth: 240, planWidth: 240 },
            'dock',
            500,
            420,
            1280,
        );
        expect(next.dockWidth).toBe(848);
    });

    it('exposes sizes as CSS variables and uses the full viewport on a sheet', () => {
        const dock = layoutCssVars({ dockWidth: 640, railWidth: 200, planWidth: 280 }, false);
        expect(dock['--ai-agent-panel-width']).toBe('640px');
        expect(dock['--ai-agent-rail-width']).toBe('200px');
        expect(layoutCssVars({ dockWidth: 640, railWidth: 200, planWidth: 280 }, true)['--ai-agent-panel-width'])
            .toBe('100vw');
    });
});
