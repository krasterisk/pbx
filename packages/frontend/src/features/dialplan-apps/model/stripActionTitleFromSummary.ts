/** Drop a leading action title from summarize() so StepRow / flowchart do not repeat it. */
export function stripActionTitleFromSummary(title: string, summary: string): string {
  const rawTitle = title.trim();
  const rawSummary = summary.trim();
  if (!rawTitle || !rawSummary) return rawSummary;

  const stripped = stripPrefix(rawSummary, rawTitle);
  if (stripped !== null) return stripped;

  const firstWord = rawTitle.split(/\s+/)[0] ?? '';
  if (
    firstWord.length >= 2
    && firstWord.localeCompare(rawTitle, undefined, { sensitivity: 'accent' }) !== 0
  ) {
    const fromWord = stripPrefix(rawSummary, firstWord);
    if (fromWord !== null) return fromWord;
  }

  return rawSummary;
}

function stripPrefix(summary: string, prefix: string): string | null {
  const p = prefix.trim();
  if (!p) return null;
  if (summary.localeCompare(p, undefined, { sensitivity: 'accent' }) === 0) {
    return '';
  }
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(?:\\s*[:—–-]\\s*|\\s*#\\s*|\\s+)`, 'iu');
  if (!re.test(summary)) return null;
  return summary.replace(re, '').trim();
}
