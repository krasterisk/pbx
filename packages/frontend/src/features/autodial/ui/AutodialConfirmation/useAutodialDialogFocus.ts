import { useCallback, useRef } from 'react';

/** Controlled dialogs have no Radix Trigger; retain the actual initiating control. */
export function useAutodialDialogFocus(returnFocusTo?: HTMLElement | null) {
  const origin = useRef<HTMLElement | null>(null);
  const generation = useRef(0);
  const onOpenAutoFocus = useCallback(() => {
    generation.current += 1;
    origin.current = returnFocusTo?.isConnected ? returnFocusTo : document.activeElement instanceof HTMLElement
      && document.activeElement !== document.body ? document.activeElement : null;
  }, [returnFocusTo]);
  const onCloseAutoFocus = useCallback((event: Event) => {
    const target = origin.current, current = generation.current;
    if (!target?.isConnected) return;
    event.preventDefault();
    // A nested discard confirmation also closes; restore after its focus cleanup.
    window.setTimeout(() => {
      if (generation.current === current && target.isConnected
        && !target.closest('[aria-hidden="true"], [inert]')) target.focus({ preventScroll: true });
    }, 0);
  }, []);
  return { onOpenAutoFocus, onCloseAutoFocus };
}
