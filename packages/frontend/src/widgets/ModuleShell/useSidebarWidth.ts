import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

const WIDTH_KEY = 'krasterisk.moduleShell.width';
export const MIN_SIDEBAR_WIDTH = 200;
const DEFAULT_WIDTH = 240;
export function maxSidebarWidth(viewport: number) { return Math.max(MIN_SIDEBAR_WIDTH, Math.min(480, Math.floor(viewport / 2))); }
export function clampSidebarWidth(width: number, viewport: number) { return Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxSidebarWidth(viewport), width)); }

export function useSidebarWidth(collapsed: boolean) {
  const [viewport, setViewport] = useState(() => window.innerWidth);
  const [preferredWidth, setPreferredWidth] = useState(() => {
    try { const stored = Number(localStorage.getItem(WIDTH_KEY)); return Number.isFinite(stored) && stored >= MIN_SIDEBAR_WIDTH ? Math.min(480, stored) : DEFAULT_WIDTH; }
    catch { return DEFAULT_WIDTH; }
  });
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number; startPreferredWidth: number; width: number; cursor: string; userSelect: string } | null>(null);
  const width = clampSidebarWidth(preferredWidth, viewport);
  const finish = useCallback((save: boolean) => {
    const session = drag.current;
    if (!session) return;
    drag.current = null;
    document.body.style.cursor = session.cursor;
    document.body.style.userSelect = session.userSelect;
    if (save) { try { localStorage.setItem(WIDTH_KEY, String(session.width)); } catch { /* In-memory preference remains usable. */ } }
    else setPreferredWidth(session.startPreferredWidth);
    setResizing(false);
  }, []);
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    const onBlur = () => finish(false);
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', onBlur);
      const session = drag.current;
      if (session) { document.body.style.cursor = session.cursor; document.body.style.userSelect = session.userSelect; }
    };
  }, [finish]);
  useEffect(() => { if (collapsed) finish(false); }, [collapsed, finish]);
  const saveWidth = (next: number) => {
    const clamped = clampSidebarWidth(next, viewport);
    setPreferredWidth(clamped);
    try { localStorage.setItem(WIDTH_KEY, String(clamped)); } catch { /* Keep the local width. */ }
  };
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || collapsed || event.pointerType === 'touch') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width, startPreferredWidth: preferredWidth, width, cursor: document.body.style.cursor, userSelect: document.body.style.userSelect };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setResizing(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    session.width = clampSidebarWidth(session.startWidth + event.clientX - session.startX, window.innerWidth);
    setPreferredWidth(session.width);
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    finish(true);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const next = event.key === 'ArrowLeft' ? width - 16 : event.key === 'ArrowRight' ? width + 16
      : event.key === 'Home' ? MIN_SIDEBAR_WIDTH : event.key === 'End' ? maxSidebarWidth(viewport) : undefined;
    if (next === undefined) return;
    event.preventDefault(); saveWidth(next);
  };
  return { width, maxWidth: maxSidebarWidth(viewport), resizing, onPointerDown, onPointerMove, onPointerUp,
    onPointerCancel: () => finish(false), onLostPointerCapture: () => finish(false), onKeyDown };
}
