import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CcDashboardPreset } from '@krasterisk/shared';
import type { CcDashboardOverviewParams } from '@/shared/api/endpoints/callCenterDashboardApi';

export const CC_DASHBOARD_PRESETS: readonly CcDashboardPreset[] = ['today', 'yesterday', '7d', '30d', 'custom'];

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function parsePreset(raw: string | null): CcDashboardPreset {
  return CC_DASHBOARD_PRESETS.includes(raw as CcDashboardPreset) ? (raw as CcDashboardPreset) : 'today';
}

function parseQueues(raw: string | null): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((q) => q.trim()).filter(Boolean))];
}

/**
 * Dashboard filters live in the URL (so a view can be sent as a link). Defaults are omitted from
 * the URL: today, comparison on, all queues.
 */
export function useCcDashboardParams() {
  const [search, setSearch] = useSearchParams();

  const period = parsePreset(search.get('period'));
  const rawFrom = search.get('from');
  const rawTo = search.get('to');
  const from = rawFrom && DATE_KEY.test(rawFrom) ? rawFrom : undefined;
  const to = rawTo && DATE_KEY.test(rawTo) ? rawTo : undefined;
  const compare = search.get('compare') !== '0';
  const queuesKey = search.get('queues') ?? '';

  const params = useMemo<CcDashboardOverviewParams>(
    () => ({ period, from, to, compare, queues: parseQueues(queuesKey) }),
    [period, from, to, compare, queuesKey],
  );

  /** A custom period without both dates cannot be asked for yet. */
  const ready = period !== 'custom' || (from !== undefined && to !== undefined && from <= to);

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearch],
  );

  const setPeriod = useCallback(
    (preset: CcDashboardPreset) =>
      update((next) => {
        if (preset === 'today') next.delete('period');
        else next.set('period', preset);
        if (preset !== 'custom') {
          next.delete('from');
          next.delete('to');
        }
      }),
    [update],
  );

  const setRange = useCallback(
    (nextFrom: string | undefined, nextTo: string | undefined) =>
      update((next) => {
        next.set('period', 'custom');
        if (nextFrom) next.set('from', nextFrom);
        else next.delete('from');
        if (nextTo) next.set('to', nextTo);
        else next.delete('to');
      }),
    [update],
  );

  const setCompare = useCallback(
    (value: boolean) =>
      update((next) => {
        if (value) next.delete('compare');
        else next.set('compare', '0');
      }),
    [update],
  );

  const setQueues = useCallback(
    (queues: string[]) =>
      update((next) => {
        if (queues.length === 0) next.delete('queues');
        else next.set('queues', queues.join(','));
      }),
    [update],
  );

  return { params, ready, setPeriod, setRange, setCompare, setQueues };
}
