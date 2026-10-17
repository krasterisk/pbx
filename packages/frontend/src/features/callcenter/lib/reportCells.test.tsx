import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReportColumn } from '@/shared/api/endpoints/callCenterReportsApi';
import { DEFAULT_KPI_THRESHOLDS } from './kpiThresholds';
import {
  ReportCell,
  computeReportTotals,
  formatReportValue,
  hasReportTotals,
  reportCellTone,
  reportColumnTitle,
  type ReportCellContext,
} from './reportCells';

const ctx: ReportCellContext = {
  locale: 'ru',
  t: (_key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : _key),
  agentLabel: (i) => `agent:${i}`,
  queueLabel: (q) => `queue:${q}`,
  thresholds: { ...DEFAULT_KPI_THRESHOLDS },
};

const col = (partial: Partial<ReportColumn> & { key: string }): ReportColumn => ({ header: partial.key, ...partial });

describe('formatReportValue', () => {
  it('renders dates in the report timezone independently of the browser timezone', () => {
    const column = col({ key: 'enterTime', type: 'datetime' });
    const instant = '2026-10-16T04:05:06Z';
    expect(formatReportValue(column, instant, { ...ctx, timezone: 'UTC' })).toContain('04:05:06');
    expect(formatReportValue(column, instant, { ...ctx, timezone: 'Asia/Krasnoyarsk' })).toContain('11:05:06');
  });
  it('formats a duration in seconds as m:ss', () => {
    expect(formatReportValue(col({ key: 'ahtSec', type: 'duration' }), 75, ctx)).toBe('1:15');
  });

  it('formats a percent value with a decimal comma', () => {
    expect(formatReportValue(col({ key: 'slaPct', type: 'percent' }), 38.1, ctx)).toBe('38,1 %');
    expect(formatReportValue(col({ key: 'slaPct', type: 'percent' }), 38.1, { ...ctx, locale: 'en' })).toBe('38.1%');
  });

  it('shows agents and queues by display name', () => {
    expect(formatReportValue(col({ key: 'agentInterface', type: 'agent' }), 'PJSIP/e101_0', ctx)).toBe('agent:PJSIP/e101_0');
    expect(formatReportValue(col({ key: 'queueName', type: 'queue' }), 'q1_4', ctx)).toBe('queue:q1_4');
  });

  it('renders booleans in words and empty values as a dash', () => {
    expect(formatReportValue(col({ key: 'isPaid', type: 'boolean' }), true, ctx)).toBe('Yes');
    expect(formatReportValue(col({ key: 'isPaid', type: 'boolean' }), false, ctx)).toBe('No');
    expect(formatReportValue(col({ key: 'note', type: 'text' }), '', ctx)).toBe('—');
    expect(formatReportValue(col({ key: 'ahtSec', type: 'duration' }), null, ctx)).toBe('—');
  });

  it('groups thousands in counts', () => {
    expect(formatReportValue(col({ key: 'totalCalls', type: 'count' }), 12345, { ...ctx, locale: 'en' })).toBe('12,345');
  });

  it('formats a timestamp without exposing the ISO string', () => {
    const text = formatReportValue(col({ key: 'enterTime', type: 'datetime' }), '2026-07-01T10:20:30.000Z', ctx);
    expect(text).not.toContain('T10');
    expect(text).toMatch(/\d{2}[./]\d{2}/);
  });
});

describe('computeReportTotals', () => {
  const columns: ReportColumn[] = [
    col({ key: 'queueName', type: 'queue' }),
    col({ key: 'totalCalls', type: 'count', total: 'sum' }),
    col({ key: 'shortAbandonedCalls', type: 'count', total: 'sum' }),
    col({ key: 'slaPct', type: 'percent', total: 'weighted', weightKey: 'totalCalls', weightMinusKey: 'shortAbandonedCalls' }),
    col({ key: 'maxWaitSec', type: 'duration', total: 'max' }),
  ];

  it('sums counts, takes the maximum and weights the rate by its denominator', () => {
    const totals = computeReportTotals(columns, [
      { queueName: 'a', totalCalls: 100, shortAbandonedCalls: 0, slaPct: 90, maxWaitSec: 30 },
      { queueName: 'b', totalCalls: 10, shortAbandonedCalls: 0, slaPct: 50, maxWaitSec: 120 },
    ]);
    expect(totals.totalCalls).toBe(110);
    expect(totals.maxWaitSec).toBe(120);
    // (90*100 + 50*10) / 110, not the plain average 70
    expect(totals.slaPct).toBeCloseTo(86.36, 2);
  });

  it('removes short abandons from the weight', () => {
    const totals = computeReportTotals(columns, [
      { totalCalls: 10, shortAbandonedCalls: 10, slaPct: 0 },
      { totalCalls: 20, shortAbandonedCalls: 0, slaPct: 80 },
    ]);
    expect(totals.slaPct).toBe(80);
  });

  it('has no total when no row can be counted', () => {
    const totals = computeReportTotals(columns, [{ totalCalls: 5, shortAbandonedCalls: 5, slaPct: 0 }]);
    expect(totals.slaPct).toBeUndefined();
  });

  it('reports whether a report has totals at all', () => {
    expect(hasReportTotals(columns)).toBe(true);
    expect(hasReportTotals([col({ key: 'note', type: 'text' })])).toBe(false);
  });
});

describe('thresholds and titles', () => {
  it('colours SLA below the critical threshold as destructive', () => {
    expect(reportCellTone(col({ key: 'slaPct', type: 'percent' }), 40, DEFAULT_KPI_THRESHOLDS)).toBe('destructive');
    expect(reportCellTone(col({ key: 'slaPct', type: 'percent' }), 99, DEFAULT_KPI_THRESHOLDS)).toBe('success');
    expect(reportCellTone(col({ key: 'ahtSec', type: 'duration' }), 99, DEFAULT_KPI_THRESHOLDS)).toBeUndefined();
  });

  it('marks the cell for assistive / test queries', () => {
    render(<div>{ReportCell({ col: col({ key: 'slaPct', type: 'percent' }), value: 40, ctx })}</div>);
    expect(screen.getByText('40 %')).toHaveAttribute('data-tone', 'destructive');
  });

  it('titles a column by its i18n key with the English header as the fallback', () => {
    expect(reportColumnTitle(col({ key: 'ahtSec', header: 'AHT (sec)', labelKey: 'callcenter.reports.col.ahtSec' }), ctx.t)).toBe('AHT (sec)');
    expect(reportColumnTitle(col({ key: 'x', header: 'X' }), ctx.t)).toBe('X');
  });
});
