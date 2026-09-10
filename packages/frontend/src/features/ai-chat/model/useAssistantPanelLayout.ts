import { useCallback, useEffect, useRef, useState } from 'react';
import {
    applyResize,
    clampLayout,
    layoutCssVars,
    readAssistantPanelLayout,
    writeAssistantPanelLayout,
    type AssistantPanelLayout,
} from './assistantPanelLayout';

export type AssistantPanelResizeEdge = 'dock' | 'rail' | 'plan';

function viewportWidth(): number {
    return typeof window === 'undefined' ? 1280 : window.innerWidth;
}

export function useAssistantPanelLayout(sheet: boolean) {
    const [layout, setLayout] = useState<AssistantPanelLayout>(() => readAssistantPanelLayout(viewportWidth()));
    const layoutRef = useRef(layout);
    layoutRef.current = layout;

    useEffect(() => {
        const onResize = () => {
            setLayout((prev) => clampLayout(prev, viewportWidth()));
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const persist = useCallback((next: AssistantPanelLayout) => {
        const clamped = clampLayout(next, viewportWidth());
        layoutRef.current = clamped;
        setLayout(clamped);
        writeAssistantPanelLayout(clamped);
    }, []);

    const startResize = useCallback((edge: AssistantPanelResizeEdge, startX: number) => {
        const origin = layoutRef.current;
        const onMove = (event: PointerEvent) => {
            const next = applyResize(origin, edge, startX, event.clientX, viewportWidth());
            layoutRef.current = next;
            setLayout(next);
        };
        const onUp = () => {
            writeAssistantPanelLayout(layoutRef.current);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }, []);

    const nudge = useCallback((edge: AssistantPanelResizeEdge, delta: number) => {
        persist(applyResize(layoutRef.current, edge, 0, delta, viewportWidth()));
    }, [persist]);

    return {
        layout,
        cssVars: layoutCssVars(layout, sheet),
        startResize,
        nudge,
    };
}
