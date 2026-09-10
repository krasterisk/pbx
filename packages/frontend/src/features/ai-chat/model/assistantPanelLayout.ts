export const ASSISTANT_PANEL_LAYOUT_KEY = 'assistant-panel-layout';

export type AssistantPanelLayout = {
    dockWidth: number;
    railWidth: number;
    planWidth: number;
};

export const LAYOUT_DEFAULTS = {
    railWidth: 240,
    planWidth: 240,
} as const;

const DOCK_MIN = 360;
const DOCK_MAX_VW = 0.92;
const DOCK_MARGIN = 80;
const RAIL_MIN = 180;
const RAIL_MAX = 420;

export function defaultDockWidth(viewportWidth: number): number {
    return clampDockWidth(Math.round(viewportWidth * 0.6), viewportWidth);
}

export function clampDockWidth(width: number, viewportWidth: number): number {
    const max = Math.max(DOCK_MIN, Math.min(
        Math.round(viewportWidth * DOCK_MAX_VW),
        viewportWidth - DOCK_MARGIN,
    ));
    return Math.min(max, Math.max(DOCK_MIN, Math.round(width)));
}

export function clampRailWidth(width: number): number {
    return Math.min(RAIL_MAX, Math.max(RAIL_MIN, Math.round(width)));
}

export function clampLayout(
    layout: AssistantPanelLayout,
    viewportWidth: number,
): AssistantPanelLayout {
    return {
        dockWidth: clampDockWidth(layout.dockWidth, viewportWidth),
        railWidth: clampRailWidth(layout.railWidth),
        planWidth: clampRailWidth(layout.planWidth),
    };
}

export function emptyLayout(viewportWidth: number): AssistantPanelLayout {
    return {
        dockWidth: defaultDockWidth(viewportWidth),
        railWidth: LAYOUT_DEFAULTS.railWidth,
        planWidth: LAYOUT_DEFAULTS.planWidth,
    };
}

export function readAssistantPanelLayout(viewportWidth: number): AssistantPanelLayout {
    const fallback = emptyLayout(viewportWidth);
    try {
        const raw = localStorage.getItem(ASSISTANT_PANEL_LAYOUT_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as Partial<AssistantPanelLayout>;
        return clampLayout({
            dockWidth: Number(parsed.dockWidth) || fallback.dockWidth,
            railWidth: Number(parsed.railWidth) || fallback.railWidth,
            planWidth: Number(parsed.planWidth) || fallback.planWidth,
        }, viewportWidth);
    } catch {
        return fallback;
    }
}

export function writeAssistantPanelLayout(layout: AssistantPanelLayout): void {
    try {
        localStorage.setItem(ASSISTANT_PANEL_LAYOUT_KEY, JSON.stringify(layout));
    } catch {
        /* ignore quota / private mode */
    }
}

export function layoutCssVars(
    layout: AssistantPanelLayout,
    sheet: boolean,
): Record<string, string> {
    return {
        '--ai-agent-panel-width': sheet ? '100vw' : `${layout.dockWidth}px`,
        '--ai-agent-rail-width': `${layout.railWidth}px`,
        '--ai-agent-plan-width': `${layout.planWidth}px`,
    };
}

export function applyResize(
    layout: AssistantPanelLayout,
    edge: 'dock' | 'rail' | 'plan',
    startX: number,
    clientX: number,
    viewportWidth: number,
): AssistantPanelLayout {
    const delta = clientX - startX;
    if (edge === 'dock') {
        return clampLayout({ ...layout, dockWidth: layout.dockWidth - delta }, viewportWidth);
    }
    if (edge === 'rail') {
        return clampLayout({ ...layout, railWidth: layout.railWidth + delta }, viewportWidth);
    }
    return clampLayout({ ...layout, planWidth: layout.planWidth - delta }, viewportWidth);
}
