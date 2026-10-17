import { shiftDateKey, zonedDateKey, zonedDayWindow } from '../callcenter-metrics/timezone';
import {
  CC_DASHBOARD_LIMITS,
  type CcDashboardPeriod,
  type CcDashboardPreset,
  type CcDashboardWindow,
} from './types';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export class CcDashboardPeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CcDashboardPeriodError';
  }
}

export interface ResolveCcDashboardPeriodInput {
  preset: CcDashboardPreset;
  /** Tenant-local `YYYY-MM-DD`, only for `custom`. */
  dateFrom?: string;
  dateTo?: string;
  compare: boolean;
  now: Date;
  timezone: string;
}

/** Whole local days from `dateFrom` to `dateTo`, both inclusive. */
export function daysBetweenKeys(dateFrom: string, dateTo: string): number {
  const [fy, fm, fd] = dateFrom.split('-').map(Number);
  const [ty, tm, td] = dateTo.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS) + 1;
}

function isRealDateKey(key: string): boolean {
  if (!DATE_KEY.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/**
 * Resolve a preset into tenant-local calendar days plus the UTC instants they cover, and the
 * comparison window. A period in progress is trimmed to "now" and its comparison window is trimmed
 * to the same elapsed time, so a half-finished day is never compared to a whole one.
 */
export function resolveCcDashboardPeriod(input: ResolveCcDashboardPeriodInput): CcDashboardPeriod {
  const { preset, compare, now, timezone } = input;
  const today = zonedDateKey(now, timezone);

  let dateFrom: string;
  let dateTo: string;
  switch (preset) {
    case 'today':
      dateFrom = dateTo = today;
      break;
    case 'yesterday':
      dateFrom = dateTo = shiftDateKey(today, -1);
      break;
    case '7d':
      dateFrom = shiftDateKey(today, -6);
      dateTo = today;
      break;
    case '30d':
      dateFrom = shiftDateKey(today, -29);
      dateTo = today;
      break;
    case 'custom': {
      if (!input.dateFrom || !input.dateTo || !isRealDateKey(input.dateFrom) || !isRealDateKey(input.dateTo)) {
        throw new CcDashboardPeriodError('Custom period needs dateFrom and dateTo as YYYY-MM-DD');
      }
      if (input.dateFrom > input.dateTo) {
        throw new CcDashboardPeriodError('dateFrom must not be after dateTo');
      }
      if (input.dateTo > today) {
        throw new CcDashboardPeriodError('The period cannot end in the future');
      }
      dateFrom = input.dateFrom;
      dateTo = input.dateTo;
      break;
    }
    default:
      throw new CcDashboardPeriodError(`Unknown period preset: ${String(preset)}`);
  }

  const days = daysBetweenKeys(dateFrom, dateTo);
  if (days > CC_DASHBOARD_LIMITS.maxPeriodDays) {
    throw new CcDashboardPeriodError(`The period is limited to ${CC_DASHBOARD_LIMITS.maxPeriodDays} days`);
  }

  const fromInstant = zonedDayWindow(dateFrom, timezone).from;
  const fullTo = zonedDayWindow(dateTo, timezone).to;
  const includesToday = dateTo >= today;
  const to = includesToday ? new Date(Math.min(fullTo.getTime(), now.getTime())) : fullTo;

  let previous: CcDashboardWindow | null = null;
  if (compare) {
    let prevFrom: string;
    let prevTo: string;
    if (preset === 'today') {
      prevFrom = prevTo = shiftDateKey(today, -7);
    } else {
      prevTo = shiftDateKey(dateFrom, -1);
      prevFrom = shiftDateKey(prevTo, -(days - 1));
    }
    const prevFromInstant = zonedDayWindow(prevFrom, timezone).from;
    const prevFullTo = zonedDayWindow(prevTo, timezone).to;
    const elapsed = to.getTime() - fromInstant.getTime();
    const prevToInstant = includesToday
      ? new Date(Math.min(prevFullTo.getTime(), prevFromInstant.getTime() + elapsed))
      : prevFullTo;
    previous = {
      dateFrom: prevFrom,
      dateTo: prevTo,
      from: prevFromInstant.toISOString(),
      to: prevToInstant.toISOString(),
    };
  }

  return {
    preset,
    timezone,
    dateFrom,
    dateTo,
    from: fromInstant.toISOString(),
    to: to.toISOString(),
    days,
    includesToday,
    previous,
  };
}
