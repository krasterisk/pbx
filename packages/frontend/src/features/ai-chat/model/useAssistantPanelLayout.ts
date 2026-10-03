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
    const [layout, setLayout] = useState<AssistantPanelLayout>(() => readAssistantPanelLayout(viewportWidth() < 768 ? 1280 : viewportWidth()));
    const layoutRef = useRef(layout);
    const resizeCleanupRef = useRef<(() => void) | null>(null);
    layoutRef.current = layout;
    useEffect(() => () => resizeCleanupRef.current?.(), []);

    useEffect(() => {
        const onResize = () => {
            if (viewportWidth() < 768) return;
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
        resizeCleanupRef.current?.();
        const origin = layoutRef.current;
        const onMove = (event: PointerEvent) => {
            const next = applyResize(origin, edge, startX, event.clientX, viewportWidth());
            layoutRef.current = next;
            setLayout(next);
        };
        const onUp = () => {
            writeAssistantPanelLayout(layoutRef.current);
            cleanup();
            resizeCleanupRef.current = null;
        };
        const cleanup = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            window.removeEventListener('blur', onUp);
        };
        resizeCleanupRef.current = cleanup;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        window.addEventListener('blur', onUp);
    }, []);

    const nudge = useCallback((edge: AssistantPanelResizeEdge, delta: number) => {
        persist(applyResize(layoutRef.current, edge, 0, delta, viewportWidth()));
    }, [persist]);

    const setWidth = useCallback((dockWidth: number) => {
        persist({ ...layoutRef.current, dockWidth });
        return layoutRef.current.dockWidth;
    }, [persist]);
    const cancelResize = useCallback(() => {
        resizeCleanupRef.current?.();
        resizeCleanupRef.current = null;
    }, []);

    return {
        layout,
        setWidth,
        cancelResize,
        cssVars: layoutCssVars(layout, sheet),
        startResize,
        nudge,
    };
}
