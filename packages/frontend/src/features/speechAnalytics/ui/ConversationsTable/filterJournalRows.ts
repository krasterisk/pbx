import { resolveProjectInsights, type SaProjectConfigV1 } from '@krasterisk/shared';
import type { SaJournalRow } from '../../api/speechAnalyticsApi';

export type JournalSourceGroup = 'pbx' | 'upload' | 'api';

export type JournalTableFilters = {
  search: string;
  source: '' | JournalSourceGroup;
  dateFrom: string;
  dateTo: string;
  sentiment: '' | 'positive' | 'neutral' | 'negative';
  scoreFrom: string;
  scoreTo: string;
};

export function sourceGroup(kind: string): JournalSourceGroup {
  if (kind === 'api' || kind === 'external') return 'api';
  if (kind === 'upload') return 'upload';
  return 'pbx';
}

/** Lowest and highest CSAT bound across projects. The filter stays two fields at any width. */
export function journalScoreScale(
  projects: Array<{ draft_config?: Partial<SaProjectConfigV1> | null }>,
): { min: number; max: number } {
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const project of projects) {
    const csat = resolveProjectInsights(project.draft_config).csat;
    if (!csat.enabled) continue;
    low = Math.min(low, csat.min);
    high = Math.max(high, csat.max);
  }
  if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) {
    return { min: 1, max: 5 };
  }
  return { min: Math.trunc(low), max: Math.trunc(high) };
}

function scoreBound(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function day(occurredAt: string): string {
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return occurredAt.slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dateNum = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${dateNum}`;
}

export function filterJournalRows(items: SaJournalRow[], filters: JournalTableFilters): SaJournalRow[] {
  const query = filters.search.trim().toLowerCase();
  return items.filter((row) => {
    if (filters.source && sourceGroup(row.sourceKind) !== filters.source) return false;
    if (filters.dateFrom && day(row.occurredAt) < filters.dateFrom) return false;
    if (filters.dateTo && day(row.occurredAt) > filters.dateTo) return false;
    if (filters.sentiment && row.sentiment !== filters.sentiment) return false;
    const scoreFrom = scoreBound(filters.scoreFrom);
    const scoreTo = scoreBound(filters.scoreTo);
    if (scoreFrom != null || scoreTo != null) {
      if (row.score == null) return false;
      if (scoreFrom != null && row.score < scoreFrom) return false;
      if (scoreTo != null && row.score > scoreTo) return false;
    }
    if (!query) return true;
    const haystack = [
      row.operatorName,
      row.callerPhone,
      row.summary,
      row.projectName,
      ...(row.topics ?? []),
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query);
  });
}
