import type { DashboardBucket, DashboardPeriod } from '@krasterisk/shared';
export type DashboardChartGroup = DashboardBucket & { until: string };
const totals = ['total', 'incoming', 'outgoing', 'internal', 'external', 'accepted', 'missed', 'unknown'] as const;
/** Whole source intervals form balanced groups. Every business count is summed once. */
export function groupDashboardBuckets(buckets: DashboardBucket[], period: DashboardPeriod, maxGroups: number): DashboardChartGroup[] {
  if (!buckets.length) return [];
  const count = Math.min(buckets.length, Math.max(1, Math.min(300, Math.floor(maxGroups))));
  return Array.from({ length:count }, (_,index) => {
    const start = Math.floor(index * buckets.length / count);
    const end = Math.floor((index + 1) * buckets.length / count);
    const at = Date.parse(buckets[start].at) < Date.parse(period.from) ? period.from : buckets[start].at;
    const group: DashboardChartGroup = { at,until:buckets[end - 1].until ?? buckets[end]?.at ?? period.to,total:0,incoming:0,outgoing:0,internal:0,external:0,accepted:0,missed:0,unknown:0 };
    for (let offset = start; offset < end; offset += 1) for (const key of totals) group[key] += buckets[offset][key];
    return group;
  });
}
