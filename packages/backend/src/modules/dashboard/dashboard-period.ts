import { BadRequestException } from '@nestjs/common';
import type { DashboardPeriod as DashboardPeriodDto, DashboardQuery } from '@krasterisk/shared';

function localParts(date: Date, timezone: string): number[] {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return ['year', 'month', 'day', 'hour', 'minute', 'second'].map((type) => Number(parts.find((p) => p.type === type)?.value));
}
function localMidnight(y: number, m: number, d: number, timezone: string): Date {
  const target = Date.UTC(y, m - 1, d);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const p = localParts(new Date(instant), timezone);
    const represented = Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5]);
    const shift = target - represented;
    instant += shift;
    if (!shift) break;
  }
  return new Date(instant);
}
export function resolveDashboardPeriod(query: DashboardQuery, timezone = 'UTC', now = new Date()): DashboardPeriodDto {
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(now); } catch { throw new BadRequestException('Invalid organization timezone'); }
  let from: Date; let to: Date;
  const mode = query.period || 'today';
  if (mode === 'custom') {
    if (!query.from || !query.to || !/(Z|[+-]\d\d:\d\d)$/.test(query.from) || !/(Z|[+-]\d\d:\d\d)$/.test(query.to)) throw new BadRequestException('Custom period requires timestamps with a timezone');
    from = new Date(query.from); to = new Date(query.to);
  } else {
    if (!['today', 'yesterday', '7d', '30d'].includes(mode)) throw new BadRequestException('Invalid dashboard period');
    const [y, m, d] = localParts(now, timezone);
    const days = mode === '7d' ? 6 : mode === '30d' ? 29 : mode === 'yesterday' ? 1 : 0;
    const shifted = new Date(Date.UTC(y, m - 1, d - days));
    from = localMidnight(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), timezone);
    to = mode === 'yesterday' ? localMidnight(y, m, d, timezone) : now;
  }
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 31 * 86400000) throw new BadRequestException('Dashboard period must be positive and at most 31 days');
  return { from: from.toISOString(), to: to.toISOString(), timezone };
}
export const DashboardPeriod = { resolve: resolveDashboardPeriod };
