import type { CcReportId, ReportColumn, ReportColumnType, ReportColumnTotal } from './callcenter-reports.types';

/**
 * Column contract of the reports (cc-ux U3.3): what a value is (`type`), how it is titled in the UI
 * (`labelKey` - an i18n key, `header` stays the English fallback for CSV/XLSX/PDF) and how the totals row
 * is built. The frontend formats values by `type`, so a report never ships pre-formatted strings.
 */
export interface ReportColumnSpec {
  type: ReportColumnType;
  total?: ReportColumnTotal;
  /** `weighted` totals: the denominator column of a rate / mean. */
  weightKey?: string;
  /** Denominator is `weightKey - weightMinusKey` (e.g. offered calls minus short abandons). */
  weightMinusKey?: string;
}

const text: ReportColumnSpec = { type: 'text' };
const count = (total?: ReportColumnTotal): ReportColumnSpec => ({ type: 'count', ...(total ? { total } : {}) });
const sumCount = count('sum');
const sumDuration: ReportColumnSpec = { type: 'duration', total: 'sum' };
const date: ReportColumnSpec = { type: 'datetime' };
const agent: ReportColumnSpec = { type: 'agent' };
const queue: ReportColumnSpec = { type: 'queue' };
const flag: ReportColumnSpec = { type: 'boolean' };
const rate = (weightKey: string, weightMinusKey?: string): ReportColumnSpec => ({
  type: 'percent',
  total: 'weighted',
  weightKey,
  ...(weightMinusKey ? { weightMinusKey } : {}),
});
const mean = (weightKey: string): ReportColumnSpec => ({ type: 'duration', total: 'weighted', weightKey });

export const REPORT_COLUMN_SPECS: Record<CcReportId, Record<string, ReportColumnSpec>> = {
  'queue-summary': {
    queueName: queue,
    totalCalls: sumCount,
    answeredCalls: sumCount,
    abandonedCalls: sumCount,
    shortAbandonedCalls: sumCount,
    transferredCalls: sumCount,
    slaPct: rate('totalCalls', 'shortAbandonedCalls'),
    asrPct: rate('totalCalls', 'shortAbandonedCalls'),
    asaSec: mean('answeredCalls'),
    ahtSec: mean('answeredCalls'),
    abandonPct: rate('totalCalls', 'shortAbandonedCalls'),
    maxWaitSec: { type: 'duration', total: 'max' },
  },
  'call-detail': {
    callUniqueid: text,
    queueName: queue,
    agentInterface: agent,
    callerIdNum: text,
    callerIdName: text,
    enterTime: date,
    answerTime: date,
    endTime: date,
    waitTime: { type: 'duration' },
    talkTime: { type: 'duration' },
    holdTime: { type: 'duration' },
    wrapupTime: { type: 'duration' },
    disposition: text,
  },
  'operator-stats': {
    agentInterface: agent,
    agentUserUid: text,
    callsHandled: sumCount,
    totalTalkSec: sumDuration,
    totalHoldSec: sumDuration,
    totalWrapupSec: sumDuration,
    avgHandleSec: mean('callsHandled'),
    ahtSec: mean('callsHandled'),
    loggedInSec: sumDuration,
    totalPauseSec: sumDuration,
    totalIdleSec: sumDuration,
  },
  'pause-report': {
    agentInterface: agent,
    userId: text,
    pauseReason: text,
    pauseCount: sumCount,
    totalPauseSec: sumDuration,
    avgPauseSec: mean('pauseCount'),
    isPaid: flag,
  },
  'hourly-heatmap': {
    dayOfWeek: count(),
    hour: count(),
    callCount: sumCount,
  },
  'agent-timeline': {
    agentInterface: agent,
    segments: text,
  },
  'missed-callback': {
    uid: count(),
    callUniqueid: text,
    queueName: queue,
    callerIdNum: text,
    callerIdName: text,
    holdTime: { type: 'duration' },
    position: count(),
    calledBack: flag,
    calledBackBy: text,
    calledBackAt: date,
    note: text,
    createdAt: date,
  },
};

/** i18n key of a column title; shared by reports where the key means the same thing. */
export const reportColumnLabelKey = (key: string): string => `callcenter.reports.col.${key}`;

/**
 * Adds `type` / `labelKey` / totals to the columns a report builder produced. A column without a spec
 * is a bug in this catalog (caught by the spec test); it degrades to `text` so a report never breaks.
 */
export function typeReportColumns(reportId: CcReportId, columns: ReportColumn[]): ReportColumn[] {
  const specs = REPORT_COLUMN_SPECS[reportId] ?? {};
  return columns.map((column) => {
    const spec = specs[column.key] ?? text;
    return {
      ...column,
      type: spec.type,
      labelKey: reportColumnLabelKey(reportId === 'missed-callback' && column.key === 'holdTime' ? 'waitTime' : column.key),
      ...(spec.total ? { total: spec.total } : {}),
      ...(spec.weightKey ? { weightKey: spec.weightKey } : {}),
      ...(spec.weightMinusKey ? { weightMinusKey: spec.weightMinusKey } : {}),
    };
  });
}
