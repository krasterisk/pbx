import type { ReactNode } from 'react';
import type { ReportColumn } from '@/shared/api/endpoints/callCenterReportsApi';
import type { TranslateFn } from '@/shared/lib/translateFn';
import { formatCcDuration, formatCcPercent } from './ccFormat';
import { slaTone, type KpiThresholds } from './kpiThresholds';
import { formatPauseReason } from './displayLabels';

/** Everything a cell needs to render a value by its column type (cc-ux U3.3). */
export interface ReportCellContext {
  locale: 'ru' | 'en';
  timezone?: string;
  t: TranslateFn;
  /** Operator display name for an interface (`Анна (201)`). */
  agentLabel: (agentInterface: string) => string;
  /** Queue display name. */
  queueLabel: (queueName: string) => string;
  /** Tenant thresholds - when set, SLA / abandon / wait / operator cells are highlighted. */
  thresholds?: KpiThresholds;
  /** Median of the visible rows, used when a metric has no absolute target. */
  medians?: Record<string, number>;
}

export type CellTone = 'success' | 'warning' | 'destructive';

const EMPTY = '—';

const isEmpty = (value: unknown): boolean => value === null || value === undefined || value === '';

const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

export function formatReportValue(col: ReportColumn, value: unknown, ctx: ReportCellContext): string {
  if (isEmpty(value)) return EMPTY;
  if (col.key === 'disposition') return ctx.t(`callcenter.disposition.${String(value)}`, String(value));
  if (col.key === 'pauseReason') return formatPauseReason(String(value), ctx.t);
  switch (col.type) {
    case 'count': {
      const n = toNumber(value);
      return n === null ? EMPTY : n.toLocaleString(ctx.locale === 'ru' ? 'ru-RU' : 'en-US');
    }
    case 'percent':
      return formatCcPercent(toNumber(value), ctx.locale);
    case 'duration':
      return formatCcDuration(toNumber(value));
    case 'agent':
      return ctx.agentLabel(String(value));
    case 'queue':
      return ctx.queueLabel(String(value));
    case 'datetime': {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString(ctx.locale === 'ru' ? 'ru-RU' : 'en-GB', {
        timeZone: ctx.timezone,
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
    case 'boolean':
      return value === true || value === 1 || value === '1' || value === 'true'
        ? ctx.t('callcenter.reports.boolYes', 'Yes')
        : ctx.t('callcenter.reports.boolNo', 'No');
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

const HIGHER_IS_WORSE = new Set(['ahtSec', 'avgTalkSec', 'avgHoldSec', 'avgWrapupSec', 'pauseSharePct', 'rnaCount', 'shortCallPct', 'totalPauseSec']);
const HIGHER_IS_BETTER = new Set(['answerRatePct', 'utilizationPct', 'callsPerHour', 'callsHandled']);

/** Highlight of a value against tenant targets, then against the median of the report. */
export function reportCellTone(
  col: ReportColumn,
  value: unknown,
  thresholds?: KpiThresholds,
  medians?: Record<string, number>,
): CellTone | undefined {
  if (isEmpty(value)) return undefined;
  const n = toNumber(value);
  if (n === null) return undefined;
  if (thresholds) {
    if (col.key === 'slaPct') return slaTone(n, thresholds);
    if (col.key === 'abandonPct') {
      if (n >= thresholds.abandonRatePct) return 'destructive';
      if (n >= thresholds.abandonRatePct * 0.7) return 'warning';
      return 'success';
    }
    if (col.key === 'maxWaitSec') {
      if (n >= thresholds.maxWaitSec) return 'destructive';
      if (n >= thresholds.maxWaitSec * 0.7) return 'warning';
      return 'success';
    }
    if (col.key === 'ahtSec' && thresholds.ahtTargetSec > 0) {
      if (n > thresholds.ahtTargetSec) return 'destructive';
      if (n > thresholds.ahtTargetSec * 0.9) return 'warning';
      return 'success';
    }
    if (col.key === 'occupancyPct' && (thresholds.occupancyMinPct > 0 || thresholds.occupancyMaxPct > 0)) {
      const min = thresholds.occupancyMinPct > 0 ? thresholds.occupancyMinPct : 0;
      const max = thresholds.occupancyMaxPct > 0 ? thresholds.occupancyMaxPct : 100;
      if (n < min || n > max) return 'destructive';
      return 'success';
    }
    if (col.key === 'pauseSharePct' && thresholds.pauseShareMaxPct > 0) {
      if (n > thresholds.pauseShareMaxPct) return 'destructive';
      if (n > thresholds.pauseShareMaxPct * 0.8) return 'warning';
      return 'success';
    }
    if ((col.key === 'rnaCount' || col.key === 'answerRatePct') && thresholds.rnaRateMaxPct > 0 && col.key === 'answerRatePct') {
      const missed = 100 - n;
      if (missed > thresholds.rnaRateMaxPct) return 'destructive';
      return 'success';
    }
    if (col.key === 'shortCallPct' && thresholds.shortCallSec >= 0 && n >= 15) return 'warning';
  }
  const median = medians?.[col.key];
  if (median === undefined || median <= 0) return undefined;
  if (HIGHER_IS_WORSE.has(col.key) && n >= median * 1.5) return 'warning';
  if (HIGHER_IS_BETTER.has(col.key) && n <= median / 1.5) return 'warning';
  return undefined;
}

/** i18n title of a column; falls back to the server English header. */
export function reportColumnTitle(col: ReportColumn, t: TranslateFn): string {
  return col.labelKey ? t(col.labelKey, col.header) : col.header;
}

type Row = Record<string, unknown>;

/**
 * Totals row: `sum` adds up, `max` takes the maximum and `weighted` is the mean / rate weighted by the
 * denominator column (so the total SLA is not the average of queue SLAs). A column with no countable row
 * has no total.
 */
export function computeReportTotals(columns: readonly ReportColumn[], rows: readonly Row[]): Record<string, number | undefined> {
  const totals: Record<string, number | undefined> = {};
  for (const col of columns) {
    if (!col.total) continue;
    if (col.total === 'sum') {
      let sum = 0;
      let any = false;
      for (const row of rows) {
        const n = toNumber(row[col.key]);
        if (n !== null) {
          sum += n;
          any = true;
        }
      }
      totals[col.key] = any ? sum : undefined;
    } else if (col.total === 'max') {
      let max: number | undefined;
      for (const row of rows) {
        const n = toNumber(row[col.key]);
        if (n !== null && (max === undefined || n > max)) max = n;
      }
      totals[col.key] = max;
    } else if (col.weightKey) {
      let weighted = 0;
      let weight = 0;
      for (const row of rows) {
        const n = toNumber(row[col.key]);
        const base = toNumber(row[col.weightKey]) ?? 0;
        const minus = col.weightMinusKey ? (toNumber(row[col.weightMinusKey]) ?? 0) : 0;
        const w = base - minus;
        if (n === null || w <= 0) continue;
        weighted += n * w;
        weight += w;
      }
      totals[col.key] = weight > 0 ? weighted / weight : undefined;
    }
  }
  return totals;
}

export function hasReportTotals(columns: readonly ReportColumn[]): boolean {
  return columns.some((col) => Boolean(col.total));
}

/** Median of a column. Fewer than three values is not a median. */
export function medianOf(values: readonly number[]): number | undefined {
  if (values.length < 3) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const WORSE_WHEN_HIGHER = new Set(['ahtSec', 'avgTalkSec', 'avgHoldSec', 'avgWrapupSec', 'pauseSharePct', 'rnaCount', 'shortCallPct', 'totalPauseSec', 'abandonPct', 'maxWaitSec']);
const BETTER_WHEN_HIGHER = new Set(['answerRatePct', 'utilizationPct', 'callsPerHour', 'callsHandled', 'slaPct']);

/** Arrow for a comparison: whether the change is an improvement. Neutral metrics return null. */
export function compareDirection(key: string, current: number, previous: number): 'better' | 'worse' | null {
  if (current === previous) return null;
  const up = current > previous;
  if (WORSE_WHEN_HIGHER.has(key)) return up ? 'worse' : 'better';
  if (BETTER_WHEN_HIGHER.has(key)) return up ? 'better' : 'worse';
  return null;
}

export interface ReportCellProps {
  col: ReportColumn;
  value: unknown;
  ctx: ReportCellContext;
}

const TONE_CLASS: Record<CellTone, string> = {
  // Mixed with the foreground so the text keeps a 4.5:1 contrast on a light card (amber alone is 2:1).
  success: 'text-[color-mix(in_srgb,var(--color-success)_60%,var(--color-foreground))]',
  warning: 'text-[color-mix(in_srgb,var(--color-warning)_55%,var(--color-foreground))]',
  destructive: 'text-[color-mix(in_srgb,var(--color-destructive)_70%,var(--color-foreground))] font-medium',
};

/** A formatted cell; SLA / abandon / wait are coloured by the tenant thresholds. */
export function ReportCell({ col, value, ctx }: ReportCellProps): ReactNode {
  const text = formatReportValue(col, value, ctx);
  const tone = reportCellTone(col, value, ctx.thresholds, ctx.medians);
  if (!tone) return text;
  return <span className={TONE_CLASS[tone]} data-tone={tone}>{text}</span>;
}
