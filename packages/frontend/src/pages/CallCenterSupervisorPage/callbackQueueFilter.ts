/** Client-side D-50 filter — same tokens as `cc:supervisor:queueFilter`. */
export function filterCallbackRowsByQueue<T extends { queue_label: string | null }>(
  rows: T[],
  filter: readonly string[],
): T[] {
  if (filter.length === 0) return rows;
  const tokens = new Set(filter.map((q) => q.trim().toLowerCase()).filter(Boolean));
  if (tokens.size === 0) return rows;
  return rows.filter((row) => {
    const name = (row.queue_label ?? '').trim().toLowerCase();
    if (!name) return false;
    if (tokens.has(name)) return true;
    const fromPrefixed = name.match(/^q(.+)_\d+$/i)?.[1];
    return fromPrefixed != null && tokens.has(fromPrefixed);
  });
}
