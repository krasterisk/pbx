import type { SaJournalRow } from '../../api/speechAnalyticsApi';

export type JournalSourceGroup = 'pbx' | 'upload' | 'api';

export type JournalTableFilters = {
  search: string;
  source: '' | JournalSourceGroup;
  dateFrom: string;
  dateTo: string;
  sentiment: '' | 'positive' | 'neutral' | 'negative';
  scores: number[];
};

export function sourceGroup(kind: string): JournalSourceGroup {
  if (kind === 'api' || kind === 'external') return 'api';
  if (kind === 'upload') return 'upload';
  return 'pbx';
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
    if (filters.scores.length > 0 && (row.score == null || !filters.scores.includes(row.score))) {
      return false;
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
