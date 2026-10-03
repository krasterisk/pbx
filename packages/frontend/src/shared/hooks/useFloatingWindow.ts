import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

type Point = { x: number; y: number };
type Geometry = Point & { height: number; launcher: Point };
type Gesture = 'move' | 'launcher' | 'resize';
const MARGIN = 16;
const LAUNCHER_SIZE = 60;

function limit(value: number, min: number, max: number) {
    return Math.min(Math.max(min, max), Math.max(min, value));
}

function fitPoint(point: Point, width: number, height: number): Point {
    return {
        x: limit(point.x, MARGIN, window.innerWidth - width - MARGIN),
        y: limit(point.y, MARGIN, window.innerHeight - height - MARGIN),
    };
}

function fit(geometry: Geometry, width: number, minViewportWidth = 0): Geometry {
    if (window.innerWidth < minViewportWidth) {
        return { ...geometry, launcher: fitPoint(geometry.launcher, LAUNCHER_SIZE, LAUNCHER_SIZE) };
    }
    const height = limit(geometry.height, Math.min(360, window.innerHeight - 2 * MARGIN), window.innerHeight - 2 * MARGIN);
    return {
        ...fitPoint(geometry, width, height),
        height,
        launcher: fitPoint(geometry.launcher, LAUNCHER_SIZE, LAUNCHER_SIZE),
    };
}

function readGeometry(key: string, width: number, minViewportWidth: number): Geometry {
    const fallback: Geometry = {
        x: window.innerWidth - width - MARGIN,
        y: 80,
        height: 640,
        launcher: { x: window.innerWidth - LAUNCHER_SIZE - MARGIN, y: window.innerHeight - LAUNCHER_SIZE - 88 },
    };
    try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as Geometry | null;
        if (parsed && [parsed.x, parsed.y, parsed.height, parsed.launcher?.x, parsed.launcher?.y].every(Number.isFinite)) {
            return fit(parsed, width, minViewportWidth);
        }
    } catch { /* Private storage or obsolete geometry: use safe defaults. */ }
    return fit(fallback, width, minViewportWidth);
}

/** Non-modal window geometry; presentation and business state belong to the caller. */
export function useFloatingWindow(width: number, onWidthChange: (width: number) => void, storageKey: string, minViewportWidth = 0) {
    const [geometry, setGeometry] = useState(() => readGeometry(storageKey, width, minViewportWidth));
    const [dragging, setDragging] = useState(false);
    const current = useRef(geometry);
    const widthRef = useRef(width);
    widthRef.current = width;
    const cleanupRef = useRef<(() => void) | null>(null);
    const suppressClick = useRef(false);

    const update = useCallback((next: Geometry, persist = false) => {
        current.current = next;
        setGeometry(next);
        if (persist) {
            try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Storage is optional. */ }
        }
    }, [storageKey]);

    useEffect(() => {
        const onResize = () => update(fit(current.current, widthRef.current, minViewportWidth));
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [width, update, minViewportWidth]);

    useEffect(() => () => cleanupRef.current?.(), []);

    const cancelGesture = useCallback(() => {
        cleanupRef.current?.();
        cleanupRef.current = null;
        setDragging(false);
    }, []);

    const start = useCallback((kind: Gesture, event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || event.isPrimary === false) return;
        event.preventDefault();
        cleanupRef.current?.();
        suppressClick.current = false;
        const origin = current.current;
        const startWidth = widthRef.current;
        const startX = event.clientX;
        const startY = event.clientY;
        const pointerId = event.pointerId;
        let moved = false;
        const onMove = (next: globalThis.PointerEvent) => {
            if (next.pointerId !== pointerId) return;
            const dx = next.clientX - startX;
            const dy = next.clientY - startY;
            if (!moved && Math.hypot(dx, dy) < 4) return;
            moved = true;
            suppressClick.current = true;
            setDragging(true);
            if (kind === 'launcher') {
                update({ ...origin, launcher: fitPoint({ x: origin.launcher.x + dx, y: origin.launcher.y + dy }, LAUNCHER_SIZE, LAUNCHER_SIZE) });
            } else if (kind === 'resize') {
                const nextWidth = limit(startWidth + dx, 360, window.innerWidth - origin.x - MARGIN);
                onWidthChange(nextWidth);
                update(fit({ ...origin, height: origin.height + dy }, nextWidth));
            } else {
                update(fit({ ...origin, x: origin.x + dx, y: origin.y + dy }, widthRef.current));
            }
        };
        const cleanup = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
            window.removeEventListener('blur', onBlur);
        };
        const finish = () => {
            cleanup();
            cleanupRef.current = null;
            setDragging(false);
            const next = current.current;
            if (kind === 'launcher' && moved) {
                update({ ...next, launcher: fitPoint({ ...next.launcher, x: next.launcher.x < window.innerWidth / 2 ? MARGIN : window.innerWidth - LAUNCHER_SIZE - MARGIN }, LAUNCHER_SIZE, LAUNCHER_SIZE) }, true);
            } else update(next, true);
        };
        const onEnd = (next: globalThis.PointerEvent) => {
            if (next.pointerId === pointerId) finish();
        };
        const onBlur = () => finish();
        cleanupRef.current = cleanup;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
        window.addEventListener('blur', onBlur);
    }, [onWidthChange, update]);

    const onKeyDown = (kind: Gesture) => (event: KeyboardEvent<HTMLElement>) => {
        const arrows: Record<string, Point> = {
            ArrowLeft: { x: -16, y: 0 }, ArrowRight: { x: 16, y: 0 },
            ArrowUp: { x: 0, y: -16 }, ArrowDown: { x: 0, y: 16 },
        };
        const delta = arrows[event.key];
        if (!delta) return;
        event.preventDefault();
        const origin = current.current;
        if (kind === 'launcher') {
            update({ ...origin, launcher: fitPoint({ x: origin.launcher.x + delta.x, y: origin.launcher.y + delta.y }, LAUNCHER_SIZE, LAUNCHER_SIZE) }, true);
        } else if (kind === 'resize') {
            const nextWidth = limit(widthRef.current + delta.x, 360, window.innerWidth - origin.x - MARGIN);
            onWidthChange(nextWidth);
            update(fit({ ...origin, height: origin.height + delta.y }, nextWidth), true);
        } else update(fit({ ...origin, x: origin.x + delta.x, y: origin.y + delta.y }, widthRef.current), true);
    };

    return {
        dragging,
        cancelGesture,
        style: {
            '--floating-x': `${geometry.x}px`, '--floating-y': `${geometry.y}px`,
            '--floating-height': `${geometry.height}px`,
            '--launcher-x': `${geometry.launcher.x}px`, '--launcher-y': `${geometry.launcher.y}px`,
        } as CSSProperties,
        controls: (kind: Gesture) => ({ onPointerDown: (event: PointerEvent<HTMLElement>) => start(kind, event), onKeyDown: onKeyDown(kind) }),
        activateLauncher: (activate: () => void, keyboard = false) => {
            if (suppressClick.current && !keyboard) { suppressClick.current = false; return; }
            suppressClick.current = false;
            activate();
        },
    };
}
