export interface TransferTarget {
  /** Dialable extension / number. */
  value: string;
  label: string;
  /** Presence state as reported by the directory (READY, BUSY, ...). */
  presence?: string;
}

const RECENTS_KEY = 'cc:transfer:recents';
const MAX_RECENTS = 5;

/** `+380...`, `101`, `*97` - something dialable rather than a name. */
export function looksDialable(query: string): boolean {
  return /^[+*#]?[\d*#]+$/.test(query.trim());
}

/** Case-insensitive match on label or number. An empty query returns everything. */
export function filterTransferTargets<T extends TransferTarget>(targets: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...targets];
  return targets.filter((t) => t.label.toLowerCase().includes(q) || t.value.toLowerCase().includes(q));
}

/**
 * What Enter does in the search field: the first match; otherwise a typed number as is;
 * otherwise nothing.
 */
export function resolveEnterTarget(query: string, matches: readonly TransferTarget[]): string | null {
  if (matches.length > 0) return matches[0].value;
  const q = query.trim();
  return looksDialable(q) ? q : null;
}

export function loadRecentTransferTargets(): TransferTarget[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is TransferTarget => !!r && typeof (r as TransferTarget).value === 'string')
      .map((r) => ({ value: r.value, label: typeof r.label === 'string' && r.label ? r.label : r.value }))
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

/** Puts the target first, de-duplicated by value, capped at {@link MAX_RECENTS}. */
export function pushRecentTransferTarget(target: TransferTarget): TransferTarget[] {
  const next = [
    { value: target.value, label: target.label || target.value },
    ...loadRecentTransferTargets().filter((r) => r.value !== target.value),
  ].slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch { /* private mode / quota */ }
  return next;
}
