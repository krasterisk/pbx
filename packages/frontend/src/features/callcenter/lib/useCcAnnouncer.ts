import { useCallback, useEffect } from 'react';

const POLITE_ID = 'cc-live-polite';
const ASSERTIVE_ID = 'cc-live-assertive';

const SR_ONLY_STYLE =
  'position:fixed;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';

function ensureRegion(id: string, politeness: 'polite' | 'assertive'): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!el) {
    el = document.createElement('div');
    el.setAttribute('data-testid', id);
    el.setAttribute('aria-live', politeness);
    el.setAttribute('aria-atomic', 'true');
    el.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
    el.setAttribute('style', SR_ONLY_STYLE);
    document.body.appendChild(el);
  }
  return el;
}

export function announceCcPolite(text: string): void {
  const el = ensureRegion(POLITE_ID, 'polite');
  if (!el) return;
  el.textContent = text;
}

export function announceCcAssertive(text: string): void {
  const el = ensureRegion(ASSERTIVE_ID, 'assertive');
  if (!el) return;
  el.textContent = text;
}

/**
 * Shared screen-reader live announcer for Call Center events (U0.6):
 * maintains one polite and one assertive aria-live region per page.
 */
export function useCcAnnouncer(): {
  polite: (text: string) => void;
  assertive: (text: string) => void;
} {
  useEffect(() => {
    ensureRegion(POLITE_ID, 'polite');
    ensureRegion(ASSERTIVE_ID, 'assertive');
  }, []);

  const polite = useCallback((text: string) => {
    announceCcPolite(text);
  }, []);

  const assertive = useCallback((text: string) => {
    announceCcAssertive(text);
  }, []);

  return { polite, assertive };
}
