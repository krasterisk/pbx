import type { CallsQuery, OrganizationWeekStart } from '@krasterisk/shared';
import { callsParams } from '@/shared/lib/callsQueryParams';
import { readCallsQuery } from './callsUrl';

export type CallPeriod =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'fortnight'
  | 'currentWeek' | 'previousWeek'
  | 'currentMonth' | 'previousMonth' | 'last30Days'
  | 'previousQuarter' | 'currentYear' | 'previousYear'
  | 'month'
  | 'twoMonths'
  | 'threeMonths'
  | 'quarter'
  | 'year'
  | 'all'
  | 'custom';
export interface SavedCallFilter {
  name: string;
  params: string;
  period: CallPeriod;
}
export const visibleCallPeriods = ['today', 'yesterday', 'currentWeek', 'previousWeek', 'week',
  'fortnight', 'currentMonth', 'previousMonth', 'last30Days', 'twoMonths', 'quarter',
  'previousQuarter', 'currentYear', 'previousYear', 'all'] as const;
// Retain earlier stored rolling-month/year definitions without changing their dates.
const periods: CallPeriod[] = [...visibleCallPeriods, 'month', 'threeMonths', 'year', 'custom'];

export function parseCallPeriod(value: string | null): CallPeriod | undefined {
  return value && periods.includes(value as CallPeriod) ? value as CallPeriod : undefined;
}

/** Resolve the visible preset identically in the editor and collapsed summary. */
export function selectedCallPeriod(query: CallsQuery, timezone: string, hint?: CallPeriod, now = new Date(), weekStart: OrganizationWeekStart = 'monday'): CallPeriod {
  if (hint === 'custom') return hint;
  if (query.from || query.to) return 'custom';
  if (query.dateFrom === undefined && query.dateTo === undefined) return 'week';
  if (hint) {
    if (!(visibleCallPeriods as readonly string[]).includes(hint)) return 'custom';
    const dates = callPeriodParams(hint, timezone, now, weekStart);
    return query.dateFrom === dates.dateFrom && query.dateTo === dates.dateTo ? hint : 'custom';
  }
  for (const period of visibleCallPeriods) {
    const dates = callPeriodParams(period, timezone, now, weekStart);
    if (query.dateFrom === dates.dateFrom && query.dateTo === dates.dateTo) return period;
  }
  return 'custom';
}

export function callPeriodParams(
  period: Exclude<CallPeriod, 'custom'>,
  timezone: string,
  now = new Date(),
  weekStart: OrganizationWeekStart = 'monday',
) {
  if (period === 'all') return { dateFrom: '', dateTo: '' };
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const date = new Date(`${today}T12:00:00Z`);
  let end = today;
  if (period === 'currentWeek' || period === 'previousWeek') {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + (weekStart === 'sunday' ? 0 : 6)) % 7);
    if (period === 'previousWeek') {
      const last = new Date(date); last.setUTCDate(last.getUTCDate() - 1);
      end = last.toISOString().slice(0, 10);
      date.setUTCDate(date.getUTCDate() - 7);
    }
  }
  if (period === 'currentMonth' || period === 'previousMonth') {
    date.setUTCDate(1);
    if (period === 'previousMonth') {
      const last = new Date(date); last.setUTCDate(0);
      end = last.toISOString().slice(0, 10);
      date.setUTCMonth(date.getUTCMonth() - 1);
    }
  }
  date.setUTCDate(
    date.getUTCDate() -
      (period === 'week'
        ? 6
        : period === 'fortnight'
          ? 13
          : period === 'last30Days'
            ? 29
          : period === 'yesterday'
            ? 1
            : 0),
  );
  if (period === 'quarter' || period === 'previousQuarter') {
    date.setUTCDate(1);
    date.setUTCMonth(Math.floor(date.getUTCMonth() / 3) * 3);
    if (period === 'previousQuarter') {
      const last = new Date(date); last.setUTCDate(0);
      end = last.toISOString().slice(0, 10);
      date.setUTCMonth(date.getUTCMonth() - 3);
    }
  }
  if (period === 'currentYear' || period === 'previousYear') {
    date.setUTCMonth(0, 1);
    if (period === 'previousYear') {
      end = `${date.getUTCFullYear() - 1}-12-31`;
      date.setUTCFullYear(date.getUTCFullYear() - 1);
    }
  }
  if (['month', 'twoMonths', 'threeMonths', 'year'].includes(period)) {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(
      date.getUTCMonth() -
        (period === 'month'
          ? 1
          : period === 'twoMonths'
            ? 2
            : period === 'threeMonths'
              ? 3
              : 12),
    );
    const last = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  }
  const from = date.toISOString().slice(0, 10);
  return { dateFrom: from, dateTo: period === 'yesterday' ? from : end };
}

function cleanParams(query: CallsQuery): string {
  const params = callsParams(query);
  for (const key of ['cursor', 'limit', 'directorySearch']) params.delete(key);
  return params.toString();
}

export function captureCallFilter(
  name: string,
  query: CallsQuery,
  timezone: string,
  now = new Date(),
  periodHint?: CallPeriod,
  weekStart: OrganizationWeekStart = 'monday',
): SavedCallFilter {
  const period = selectedCallPeriod(query, timezone, periodHint, now, weekStart);
  const params = new URLSearchParams(cleanParams(query));
  if (
    periodHint === 'custom' &&
    !query.from &&
    !query.to &&
    query.dateFrom === undefined &&
    query.dateTo === undefined
  ) {
    const dates = callPeriodParams('week', timezone, now);
    params.set('dateFrom', dates.dateFrom);
    params.set('dateTo', dates.dateTo);
  }

  if (period !== 'custom')
    for (const key of ['dateFrom', 'dateTo', 'from', 'to']) params.delete(key);
  return { name: name.trim().slice(0, 60), params: params.toString(), period };
}

export function restoreCallFilter(
  saved: SavedCallFilter,
  timezone: string,
  now = new Date(),
  weekStart: OrganizationWeekStart = 'monday',
): URLSearchParams {
  const params = new URLSearchParams(
    cleanParams(readCallsQuery(new URLSearchParams(saved.params))),
  );
  if (saved.period !== 'custom') {
    const dates = callPeriodParams(saved.period, timezone, now, weekStart);
    params.delete('from');
    params.delete('to');
    params.set('dateFrom', dates.dateFrom);
    params.set('dateTo', dates.dateTo);
  }
  params.set('periodPreset', (visibleCallPeriods as readonly string[]).includes(saved.period) ? saved.period : 'custom');
  return params;
}

export function callFilterStorageKey(
  tenant: number,
  user: number,
): string | null {
  return Number.isSafeInteger(tenant) &&
    tenant >= 0 &&
    Number.isSafeInteger(user) &&
    user > 0
    ? `calls:saved-filters:v1:${tenant}:${user}`
    : null;
}

export function readSavedCallFilters(
  storage: Pick<Storage, 'getItem'>,
  key: string,
): SavedCallFilter[] {
  const text = storage.getItem(key);
  if (!text) return [];
  if (text.length > 180000) throw new Error('Invalid saved filters');
  const rows: unknown = JSON.parse(text);
  if (!Array.isArray(rows) || rows.length > 20)
    throw new Error('Invalid saved filters');
  return rows.map((row: unknown) => {
    if (!row || typeof row !== 'object')
      throw new Error('Invalid saved filter');
    const r = row as Record<string, unknown>;
    if (
      typeof r.name !== 'string' ||
      !r.name.trim() ||
      r.name.length > 60 ||
      typeof r.params !== 'string' ||
      r.params.length > 8192 ||
      !periods.includes(r.period as CallPeriod)
    )
      throw new Error('Invalid saved filter');
    return {
      name: r.name,
      params: cleanParams(readCallsQuery(new URLSearchParams(r.params))),
      period: r.period as CallPeriod,
    };
  });
}
