import type { DashboardQuery, DashboardPeriod, DashboardSource, DashboardCall } from '@krasterisk/shared';
import type { DashboardRowsQuery } from '@/shared/api/endpoints/dashboardApi';
export type DashboardDetail = {
  kind: 'calls' | 'endpoints' | 'trunks' | 'system' | 'cloud';
  title: string; filters?: DashboardRowsQuery; nodeId?: string;
};
export function hasDashboardValue(source: DashboardSource): boolean {
  return source.state === 'ok' || source.state === 'stale';
}
function zonedMidnight(date: string, timezone: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const wall = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  let candidate = wall;
  for (let i = 0; i < 4; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]));
    const actual = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const delta = wall - actual;
    candidate += delta;
    if (delta === 0) break;
  }
  return candidate;
}
/** Date inputs are organization calendar days; end day is inclusive. */
export function customRange(from: string, to: string, timezone = 'UTC'): DashboardQuery | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return undefined;
  const start = Date.parse(from + 'T00:00:00Z');
  const lastDay = Date.parse(to + 'T00:00:00Z');
  if (!Number.isFinite(start) || !Number.isFinite(lastDay) || lastDay < start || lastDay - start >= 31 * 86400000) return undefined;
  if (new Date(start).toISOString().slice(0, 10) !== from || new Date(lastDay).toISOString().slice(0, 10) !== to) return undefined;
  const exclusiveDate = new Date(lastDay + 86400000).toISOString().slice(0, 10);
  try {
    return { period: 'custom', from: new Date(zonedMidnight(from, timezone)).toISOString(), to: new Date(zonedMidnight(exclusiveDate, timezone)).toISOString() };
  } catch { return undefined; }
}
export function periodQuery(period: DashboardPeriod): DashboardQuery {
  return { period: 'custom', from: period.from, to: period.to };
}
export function sectionLink(kind: DashboardDetail['kind'], filters: DashboardRowsQuery): string | undefined {
  if (kind === 'system' || kind === 'cloud') return undefined;
  if (kind !== 'calls') {
    const query = new URLSearchParams({ dashboard: '1' });
    if (filters.search) query.set('search', filters.search);
    if (filters.status) query.set('status', filters.status);
    return '/' + kind + (query.size ? '?' + query : '');
  }
  const query = new URLSearchParams();
  query.set('dashboard', '1');
  if (filters.state) query.set('state', filters.state);
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  if (filters.direction) query.set('direction', filters.direction);
  if (filters.outcome) query.set('outcome', filters.outcome);
  if (filters.origin) query.set('origin', filters.origin);
  if (filters.search) query.set('search', filters.search);
  return '/reports/cdr?' + query;
}
export function isDashboardCall(row: DashboardCall | { id: string }): row is DashboardCall {
  return 'startedAt' in row;
}
